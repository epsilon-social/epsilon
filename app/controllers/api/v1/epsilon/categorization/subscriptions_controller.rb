# frozen_string_literal: true

module Api
  module V1
    module Epsilon
      module Categorization
        class SubscriptionsController < Api::BaseController
          before_action :require_user!

          def show
            render json: current_account.subscribed_categories.pluck(:id)
          end

          def create
            category = ::Epsilon::Categorization::CategoryMaster.active.find(params[:category_id])
            subscription = current_account.category_subscriptions.find_or_create_by!(category_master_id: category.id)

            ::Epsilon::Categorization::SubscribeBackfillWorker.new.perform(current_account.id, category.id) if subscription.previously_new_record?

            render json: subscription_state
          end

          def update
            category_ids = Array(subscription_params[:category_ids])

            previous_ids = current_account.subscribed_categories.pluck(:id)

            ActiveRecord::Base.transaction do
              current_account.category_subscriptions.destroy_all

              category_ids.each do |cat_id|
                current_account.category_subscriptions.create!(category_master_id: cat_id)
              end
            end

            # ==========================================
            # EPSILON : CATEGORIZATION SYSTEM
            submitted_ids = category_ids.map(&:to_i)

            (submitted_ids - previous_ids).each do |category_id|
              ::Epsilon::Categorization::SubscribeBackfillWorker.new.perform(current_account.id, category_id)
            end

            (previous_ids - submitted_ids).each do |category_id|
              ::Epsilon::Categorization::UnsubscribeCleanupWorker.new.perform(current_account.id, category_id)
            end
            # ==========================================

            render json: {
              success: true,
              message: I18n.t('epsilon_cat.category_saved'),
              subscribed_ids: current_account.subscribed_categories.pluck(:id),
            }
          end

          def destroy
            category_id = params[:category_id].to_i
            removed = current_account.category_subscriptions.where(category_master_id: category_id).destroy_all

            ::Epsilon::Categorization::UnsubscribeCleanupWorker.new.perform(current_account.id, category_id) if removed.any?

            render json: subscription_state
          end

          private

          def subscription_state
            {
              success: true,
              subscribed_ids: current_account.subscribed_categories.pluck(:id),
            }
          end

          def subscription_params
            params.permit(category_ids: [])
          end
        end
      end
    end
  end
end
