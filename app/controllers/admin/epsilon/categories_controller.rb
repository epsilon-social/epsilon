# frozen_string_literal: true

module Admin
  module Epsilon
    class CategoriesController < Admin::BaseController
      CATEGORIES_PER_PAGE = 25
      HASHTAGS_PER_PAGE = 50
      PREVIEW_LIMIT = 20

      def index
        authorize :tag, :index?

        @categories = ::Epsilon::Categorization::CategoryMaster
          .order(:name)
          .page(params[:page])
          .per(CATEGORIES_PER_PAGE)

        category_ids = @categories.map(&:id)
        @hashtag_counts = ::Epsilon::Categorization::HashtagMapping.where(category_master_id: category_ids).group(:category_master_id).count
        @preview_mappings = ::Epsilon::Categorization::HashtagMapping.preview_per_category(category_ids, PREVIEW_LIMIT).group_by(&:category_master_id)
        @preview_tags = resolve_tags(@preview_mappings.values.flatten.map(&:hashtag))

        @search_hashtag = normalized_search_hashtag

        if @search_hashtag.present?
          @search_tags = Tag.containing_name(@search_hashtag).order(:name).page(params[:page]).per(HASHTAGS_PER_PAGE)
          @category_ids_by_hashtag = ::Epsilon::Categorization::HashtagMapping
            .where(hashtag: @search_tags.map(&:name))
            .pluck(:hashtag, :category_master_id)
            .group_by(&:first)
            .transform_values { |pairs| pairs.map(&:last) }
          @all_categories = ::Epsilon::Categorization::CategoryMaster.active.order(:name).to_a
        end
      end

      def show
        authorize :tag, :show?

        @category = ::Epsilon::Categorization::CategoryMaster.find(params[:id])
        @hashtags = @category.hashtag_mappings.order(:hashtag).page(params[:page]).per(HASHTAGS_PER_PAGE)
        @tags = resolve_tags(@hashtags.map(&:hashtag))
        @other_categories = ::Epsilon::Categorization::CategoryMaster.active.where.not(id: @category.id).order(:name)
      end

      def create
        authorize :tag, :update?

        translations = translation_params
        name = primary_name(translations)
        @category = ::Epsilon::Categorization::CategoryMaster.new(name: name, name_translations: translations, slug: unique_category_slug(name))

        if @category.save
          redirect_to admin_epsilon_categories_path, notice: t('admin.epsilon.categorization.category_created', name: @category.display_name)
        else
          redirect_to admin_epsilon_categories_path, alert: @category.errors.full_messages.to_sentence
        end
      end

      def update
        authorize :tag, :update?

        @category = ::Epsilon::Categorization::CategoryMaster.find(params[:id])
        translations = translation_params

        if @category.update(name: primary_name(translations), name_translations: translations)
          redirect_to admin_epsilon_category_path(@category), notice: t('admin.epsilon.categorization.category_updated')
        else
          redirect_to admin_epsilon_category_path(@category), alert: @category.errors.full_messages.to_sentence
        end
      end

      def destroy
        authorize :tag, :update?

        @category = ::Epsilon::Categorization::CategoryMaster.find(params[:id])
        @category.destroy!

        redirect_to admin_epsilon_categories_path, notice: t('admin.epsilon.categorization.category_deleted', name: @category.display_name)
      end

      def reassign_hashtags
        authorize :tag, :update?

        @category = ::Epsilon::Categorization::CategoryMaster.find(params[:id])
        hashtags = Array(params[:hashtags]).map { |hashtag| hashtag.to_s.strip }.compact_blank

        if params[:mode] == 'remove'
          count = remove_hashtag_mappings(@category, hashtags)
          notice = t('admin.epsilon.categorization.hashtags_removed', count: count)
        else
          target = ::Epsilon::Categorization::CategoryMaster.active.find(params[:target_category_id])

          if params[:mode] == 'copy'
            count = add_hashtag_mappings(target, hashtags)
            notice = t('admin.epsilon.categorization.hashtags_copied', count: count, category: target.display_name)
          else
            count = migrate_hashtag_mappings(@category, target, hashtags)
            notice = t('admin.epsilon.categorization.hashtags_migrated', count: count, category: target.display_name)
          end
        end

        redirect_to admin_epsilon_category_path(@category), notice: notice
      rescue ActiveRecord::RecordNotFound
        redirect_to admin_epsilon_category_path(@category), alert: t('admin.epsilon.categorization.migrate_target_missing')
      end

      def add_hashtags
        authorize :tag, :update?

        @category = ::Epsilon::Categorization::CategoryMaster.find(params[:id])
        hashtags = parse_hashtags(params[:new_hashtags])
        added = add_hashtag_mappings(@category, hashtags)

        redirect_to admin_epsilon_category_path(@category), notice: t('admin.epsilon.categorization.hashtags_added', count: added)
      end

      private

      def parse_hashtags(raw)
        raw.to_s.split(/[\s,]+/).map { |hashtag| HashtagNormalizer.new.normalize(hashtag) }.compact_blank.uniq
      end

      def migrate_hashtag_mappings(source, target, hashtags)
        return 0 if hashtags.empty? || target.id == source.id

        moved = 0

        ::Epsilon::Categorization::HashtagMapping.where(category_master_id: source.id, hashtag: hashtags).find_each do |mapping|
          if ::Epsilon::Categorization::HashtagMapping.exists?(category_master_id: target.id, hashtag: mapping.hashtag)
            mapping.destroy!
          else
            mapping.update!(category_master_id: target.id)
          end

          moved += 1
        end

        moved
      end

      def add_hashtag_mappings(category, hashtags)
        return 0 if hashtags.empty?

        added = 0

        hashtags.each do |hashtag|
          mapping = ::Epsilon::Categorization::HashtagMapping.where(category_master_id: category.id, hashtag: hashtag).first_or_create!
          added += 1 if mapping.previously_new_record?
        end

        added
      end

      def remove_hashtag_mappings(category, hashtags)
        return 0 if hashtags.empty?

        ::Epsilon::Categorization::HashtagMapping.where(category_master_id: category.id, hashtag: hashtags).delete_all
      end

      def translation_params
        permitted = params.require(:category).permit(name_translations: ::Epsilon::Categorization::CategoryMaster::TRANSLATED_LOCALES)
        (permitted[:name_translations] || {}).to_h.transform_values { |value| value.to_s.strip }.compact_blank
      end

      def primary_name(translations)
        translations['en'].presence || translations.values.find(&:present?).to_s
      end

      def unique_category_slug(source)
        base = source.parameterize.presence&.first(50) || 'category'
        slug = base
        suffix = 2

        while ::Epsilon::Categorization::CategoryMaster.exists?(slug: slug)
          tail = "-#{suffix}"
          slug = "#{base.first(50 - tail.length)}#{tail}"
          suffix += 1
        end

        slug
      end

      def resolve_tags(hashtags)
        return {} if hashtags.blank?

        Tag.matching_name(hashtags).index_by { |tag| tag.name.downcase }
      end

      def normalized_search_hashtag
        params[:search_hashtag].to_s.strip.delete_prefix('#').downcase
      end
    end
  end
end
