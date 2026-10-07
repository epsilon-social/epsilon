# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_curated_feeds
#
#  id                       :bigint(8)        not null, primary key
#  description_translations :jsonb            not null
#  ends_at                  :datetime
#  icon                     :string
#  name                     :string           not null
#  name_translations        :jsonb            not null
#  position                 :integer          default(0), not null
#  slug                     :string           not null
#  starts_at                :datetime
#  state                    :integer          default("draft"), not null
#  created_at               :datetime         not null
#  updated_at               :datetime         not null
#  parent_id                :bigint(8)
#
class Epsilon::Curation::CuratedFeed < ApplicationRecord
  self.table_name = 'epsilon_curated_feeds'

  # Locales an admin can provide translations for. Add a locale here and it
  # shows up in the admin form + is served by the API — no migration needed.
  TRANSLATED_LOCALES = %w(en fr).freeze

  SLUG_FORMAT = /\A[a-z0-9-]+\z/

  enum :state, { draft: 0, published: 1, archived: 2 }

  belongs_to :parent, class_name: 'Epsilon::Curation::CuratedFeed', optional: true, inverse_of: :children
  has_many :children, class_name: 'Epsilon::Curation::CuratedFeed', foreign_key: :parent_id, inverse_of: :parent, dependent: :destroy
  has_many :items, class_name: 'Epsilon::Curation::FeedItem', inverse_of: :curated_feed, dependent: :delete_all

  validates :slug, presence: true, uniqueness: true, format: { with: SLUG_FORMAT }
  validates :name, presence: true
  validate :parent_must_be_top_level
  validate :time_window_must_be_ordered

  scope :top_level, -> { where(parent_id: nil) }
  scope :ordered, -> { order(position: :asc, id: :asc) }
  scope :currently_active, lambda {
    published
      .where('starts_at IS NULL OR starts_at <= ?', Time.current)
      .where('ends_at IS NULL OR ends_at >= ?', Time.current)
  }

  def currently_active?
    published? && (starts_at.nil? || starts_at <= Time.current) && (ends_at.nil? || ends_at >= Time.current)
  end

  # A parent feed aggregates its children: anything published in a child
  # shows up in the parent's timeline too.
  def self_and_children_ids
    [id, *children.ids]
  end

  # Localized name, falling back to English then the canonical `name`.
  def display_name(locale = I18n.locale)
    translations = name_translations || {}
    translations[locale.to_s].presence || translations['en'].presence || name
  end

  # Adds a status to the draft board, appended at the end. Re-adding a status
  # already in the feed (draft or published) is a no-op returning the item.
  def add_draft!(status, added_by: nil)
    with_lock do
      item = items.find_by(status_id: status.id)
      return item if item.present?

      items.create!(
        status_id: status.id,
        state: :draft,
        position: (items.draft.maximum(:position) || -1) + 1,
        added_by_account_id: added_by&.id
      )
    end
  end

  # Publishes a status right away, on top of the feed (moderator two-click
  # flow). Promotes an existing draft item instead of duplicating it.
  def add_published!(status, added_by: nil)
    with_lock do
      item = items.find_or_initialize_by(status_id: status.id)
      return item if item.published?

      item.state = :published
      item.position = Epsilon::Curation::FeedItem.next_global_position
      item.added_by_account_id ||= added_by&.id
      item.save!
      ensure_media_cached([status.id])
      item
    end
  end

  # Publishes every draft item atomically, stacking the batch above the
  # current feed content while preserving the composed draft order (draft
  # position ASC = top-to-bottom in the studio → highest feed position first).
  # Returns the number of published items.
  def publish_drafts!
    with_lock do
      drafts = items.drafts_ordered.to_a
      return 0 if drafts.empty?

      # Global counter: last arranged item takes the lowest number, so the
      # batch tops the feed (and any aggregating parent) in composed order.
      drafts.reverse_each do |item|
        item.update!(state: :published, position: Epsilon::Curation::FeedItem.next_global_position)
      end
      ensure_media_cached(drafts.map(&:status_id))
      drafts.size
    end
  end

  # Rewrites the draft board order from an ordered list of item ids (drag &
  # drop / shuffle result). Ids not belonging to this feed's drafts are ignored.
  def reorder_drafts!(ordered_item_ids)
    with_lock do
      draft_items = items.draft.index_by(&:id)
      ordered_item_ids.map(&:to_i).uniq.each_with_index do |item_id, index|
        draft_items[item_id]&.update!(position: index)
      end
    end
  end

  private

  # Curated feeds resurface posts long past the remote-media retention period;
  # (re)cache their files locally at publication, otherwise every render goes
  # through the heavily throttled /media_proxy (native: 30 req / 30 min / IP).
  def ensure_media_cached(status_ids)
    MediaAttachment.remote.where(status_id: status_ids, file_file_name: nil).pluck(:id).each do |attachment_id|
      RedownloadMediaWorker.perform_async(attachment_id)
    end
  end

  def parent_must_be_top_level
    errors.add(:parent_id, :invalid) if parent.present? && parent.parent_id.present?
  end

  def time_window_must_be_ordered
    errors.add(:ends_at, :invalid) if starts_at.present? && ends_at.present? && ends_at <= starts_at
  end
end
