# frozen_string_literal: true

module Api
  module V1
    module Epsilon
      module Categorization
        class FeedLanguagePreferencesController < Api::BaseController
          before_action :require_user!

          def show
            render json: preference_state
          end

          def update
            preference = ::Epsilon::Categorization::FeedLanguagePreference.find_or_initialize_by(account_id: current_account.id)
            preference.languages = preference_params[:languages]
            preference.save!

            # Both run inline so the client refetch right after this response
            # sees the final feed: purge now-unwanted injected statuses
            # (narrowing), refill from the subscribed categories (broadening).
            # Async backfill loses the race against the refetch and the new
            # languages only show up on a later manual refresh.
            ::Epsilon::Categorization::FeedLanguageCleanupWorker.new.perform(current_account.id) if preference.languages.present?

            current_account.subscribed_categories.pluck(:id).each do |category_id|
              ::Epsilon::Categorization::SubscribeBackfillWorker.new.perform(current_account.id, category_id)
            end

            render json: preference_state
          end

          private

          def preference_state
            { languages: current_account.epsilon_feed_language_preference&.languages }
          end

          def preference_params
            params.permit(languages: [])
          end
        end
      end
    end
  end
end
