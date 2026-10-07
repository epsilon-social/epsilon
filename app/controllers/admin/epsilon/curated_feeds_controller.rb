# frozen_string_literal: true

module Admin
  module Epsilon
    class CuratedFeedsController < Admin::BaseController
      PROTECTED_SLUG = 'discover'
      STATES = %w(draft published archived).freeze

      def index
        authorize :tag, :index?

        top_level = ::Epsilon::Curation::CuratedFeed.top_level.ordered.includes(:children)
        @feeds = top_level.flat_map { |feed| [feed, *feed.children.sort_by { |child| [child.position, child.id] }] }
        @draft_counts = ::Epsilon::Curation::FeedItem.draft.group(:curated_feed_id).count
        @published_counts = ::Epsilon::Curation::FeedItem.published.group(:curated_feed_id).count
      end

      def new
        authorize :tag, :update?

        @feed = ::Epsilon::Curation::CuratedFeed.new(state: :draft)
      end

      def edit
        authorize :tag, :update?

        @feed = ::Epsilon::Curation::CuratedFeed.find(params[:id])
      end

      def create
        authorize :tag, :update?

        @feed = ::Epsilon::Curation::CuratedFeed.new(feed_attributes)
        @feed.slug = unique_slug(@feed.name) if @feed.slug.blank?

        if @feed.save
          redirect_to admin_epsilon_curated_feeds_path, notice: t('admin.epsilon.curated_feeds.created')
        else
          flash.now[:alert] = @feed.errors.full_messages.to_sentence
          render :new
        end
      end

      def update
        authorize :tag, :update?

        @feed = ::Epsilon::Curation::CuratedFeed.find(params[:id])

        if @feed.update(feed_attributes)
          redirect_to admin_epsilon_curated_feeds_path, notice: t('admin.epsilon.curated_feeds.updated')
        else
          flash.now[:alert] = @feed.errors.full_messages.to_sentence
          render :edit
        end
      end

      def destroy
        authorize :tag, :update?

        @feed = ::Epsilon::Curation::CuratedFeed.find(params[:id])

        if @feed.slug == PROTECTED_SLUG
          redirect_to admin_epsilon_curated_feeds_path, alert: t('admin.epsilon.curated_feeds.protected')
        else
          @feed.destroy!
          redirect_to admin_epsilon_curated_feeds_path, notice: t('admin.epsilon.curated_feeds.deleted')
        end
      end

      private

      def feed_attributes
        permitted = params.require(:curated_feed).permit(
          :slug, :parent_id, :position, :state, :starts_at, :ends_at, :icon,
          name_translations: ::Epsilon::Curation::CuratedFeed::TRANSLATED_LOCALES,
          description_translations: ::Epsilon::Curation::CuratedFeed::TRANSLATED_LOCALES
        )

        name_translations = clean_translations(permitted[:name_translations])

        {
          slug: permitted[:slug].to_s.strip.downcase.presence,
          parent_id: permitted[:parent_id].presence,
          position: permitted[:position].to_i,
          state: STATES.include?(permitted[:state]) ? permitted[:state] : 'draft',
          starts_at: permitted[:starts_at].presence,
          ends_at: permitted[:ends_at].presence,
          icon: permitted[:icon].to_s.strip.presence,
          name: name_translations['en'].presence || name_translations.values.find(&:present?).to_s,
          name_translations: name_translations,
          description_translations: clean_translations(permitted[:description_translations]),
        }
      end

      def clean_translations(translations)
        (translations || {}).to_h.transform_values { |value| value.to_s.strip }.compact_blank
      end

      def unique_slug(source)
        base = source.to_s.parameterize.presence&.first(50) || 'feed'
        slug = base
        suffix = 2

        while ::Epsilon::Curation::CuratedFeed.exists?(slug: slug)
          tail = "-#{suffix}"
          slug = "#{base.first(50 - tail.length)}#{tail}"
          suffix += 1
        end

        slug
      end
    end
  end
end
