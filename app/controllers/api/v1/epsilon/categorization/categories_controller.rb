# frozen_string_literal: true

module Api
  module V1
    class Epsilon::Categorization::CategoriesController < Api::BaseController
      before_action :require_user!, only: [:suggested]

      def index
        @categories = ::Epsilon::Categorization::CategoryMaster.where(is_active: true).order(category_subscriptions_count: :desc, name: :asc)

        render json: @categories.map { |c| { id: c.id, name: c.name, name_translations: c.name_translations, slug: c.slug, subscribers_count: c.category_subscriptions_count } }
      end

      def suggested
        subscribed_ids = current_account.category_subscriptions.pluck(:category_master_id)

        query = ::Epsilon::Categorization::CategoryMaster.where(is_active: true)
        query = query.where.not(id: subscribed_ids) if subscribed_ids.any?

        @suggested_categories = query
          .order(category_subscriptions_count: :desc, name: :asc)
          .limit(15)

        render json: @suggested_categories.map { |c|
          {
            id: c.id,
            name: c.name,
            name_translations: c.name_translations,
            slug: c.slug,
            subscribers_count: c.category_subscriptions_count,
          }
        }
      end

      def show
        category_id = params[:id]

        @statuses = Status.with_category(category_id).order(id: :desc).limit(20)

        render json: @statuses, each_serializer: REST::StatusSerializer
      end

      def exclude
        category_id = params[:id]
        @statuses = Status.without_category(category_id).order(id: :desc).limit(20)
        render json: @statuses, each_serializer: REST::StatusSerializer
      end
    end
  end
end
