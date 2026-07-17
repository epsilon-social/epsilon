# frozen_string_literal: true

module Admin
  module Epsilon
    class HashtagsCategorizationController < Admin::BaseController
      before_action :set_hashtag
      before_action :set_category

      def toggle
        authorize :tag, :update?

        mappings = ::Epsilon::Categorization::HashtagMapping.where(hashtag: @hashtag, category_master_id: @category.id)

        if checked?
          mappings.first_or_create!
        else
          mappings.delete_all
        end

        render json: { hashtag: @hashtag, category_id: @category.id, checked: checked? }
      end

      private

      def set_hashtag
        @hashtag = params.require(:hashtag).to_s.strip.delete_prefix('#')

        raise ActiveRecord::RecordNotFound if @hashtag.blank?
      end

      def set_category
        @category = ::Epsilon::Categorization::CategoryMaster.active.find(params.require(:category_id))
      end

      def checked?
        ActiveModel::Type::Boolean.new.cast(params[:checked])
      end
    end
  end
end
