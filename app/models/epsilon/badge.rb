# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_badges
#
#  id                       :bigint(8)        not null, primary key
#  account_badges_count     :integer          default(0), not null
#  color                    :string           default("#800082"), not null
#  description_translations :jsonb            not null
#  icon                     :string           default("license-fill"), not null
#  is_active                :boolean          default(TRUE), not null
#  name                     :string(100)      not null
#  name_translations        :jsonb            not null
#  position                 :integer          default(0), not null
#  slug                     :string(50)       not null
#  created_at               :datetime         not null
#  updated_at               :datetime         not null
#
class Epsilon::Badge < ApplicationRecord
  self.table_name = 'epsilon_badges'

  HEX_COLOR_REGEX = /\A#(?:[0-9a-fA-F]{3}){1,2}\z/

  # Locales an admin can provide a translated name/description for. Mirrors
  # Epsilon::Categorization::CategoryMaster.
  TRANSLATED_LOCALES = %w(en fr).freeze

  # Icons are Material Symbols shared with the rest of the app (one folder). The
  # curated list is shown first in the admin picker; every other icon in the
  # folder stays reachable behind a "show more" toggle.
  CURATED_ICONS = %w(
    license-fill heart-fill heart star-fill star shield shield_question-fill
    diamond-fill diamond badge-fill key lock-fill celebration-fill bookmark-fill
    bookmarks-fill flag-fill code-fill smart_toy-fill music_note-fill movie-fill
    photo_camera-fill photo_library-fill globe-fill public-fill language-fill
    groups-fill group-fill edit-fill edit_square-fill add_photo_alternate-fill
    campaign-fill category-fill chat home-fill mail-fill mood-fill
    notifications-fill trending_up-fill explore-fill
  ).freeze

  ICON_DIRECTORY = Rails.root.join('app', 'javascript', 'material-icons', '400-24px')

  # Every icon available in the folder (sorted). Falls back to the curated list
  # if the directory can't be read (e.g. a trimmed deploy).
  ALL_ICONS = begin
    Dir.children(ICON_DIRECTORY).filter_map { |file| file.delete_suffix('.svg') if file.end_with?('.svg') }.sort.freeze
  rescue SystemCallError
    CURATED_ICONS
  end

  # Non-curated icons, for the admin "show more" section.
  EXTRA_ICONS = (ALL_ICONS - CURATED_ICONS).freeze

  has_many :account_badges, class_name: 'Epsilon::AccountBadge', foreign_key: :epsilon_badge_id, inverse_of: :badge, dependent: :destroy
  has_many :accounts, through: :account_badges, source: :account
  has_many :pending_grants, class_name: 'Epsilon::BadgePendingGrant', foreign_key: :epsilon_badge_id, inverse_of: :badge, dependent: :destroy

  validates :slug, presence: true, uniqueness: true, format: { with: /\A[a-z0-9_-]+\z/ }
  validates :name, presence: true
  validates :color, presence: true, format: { with: HEX_COLOR_REGEX }
  validates :icon, presence: true, inclusion: { in: ALL_ICONS }

  scope :active, -> { where(is_active: true) }

  # Ordre d'affichage : la `position` (croissante) départage, puis l'ancienneté.
  # C'est le premier de cette liste qui s'affiche sur les posts.
  scope :in_display_order, -> { order(:position, :id) }

  # Localized name, falling back to English then the canonical `name`.
  def display_name(locale = I18n.locale)
    translations = name_translations || {}
    translations[locale.to_s].presence || translations['en'].presence || name
  end

  # Localized description, falling back to English. Nil when none is set.
  def display_description(locale = I18n.locale)
    translations = description_translations || {}
    translations[locale.to_s].presence || translations['en'].presence
  end
end
