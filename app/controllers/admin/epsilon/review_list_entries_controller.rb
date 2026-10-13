# frozen_string_literal: true

module Admin
  module Epsilon
    class ReviewListEntriesController < Admin::BaseController
      def create
        authorize :epsilon_account_review, :update?

        entry = ::Epsilon::ReviewListEntry.new(resource_params.merge(status: :confirmed))

        if entry.save
          redirect_to admin_epsilon_account_reviews_path, notice: I18n.t('admin.epsilon.account_reviews.entries.saved')
        else
          redirect_to admin_epsilon_account_reviews_path, alert: entry.errors.full_messages.to_sentence
        end
      end

      def update
        authorize :epsilon_account_review, :update?

        ::Epsilon::ReviewListEntry.find(params[:id]).confirmed!
        redirect_to admin_epsilon_account_reviews_path, notice: I18n.t('admin.epsilon.account_reviews.entries.saved')
      end

      def destroy
        authorize :epsilon_account_review, :update?

        ::Epsilon::ReviewListEntry.find(params[:id]).destroy!
        redirect_to admin_epsilon_account_reviews_path, notice: I18n.t('admin.epsilon.account_reviews.entries.deleted')
      end

      private

      def resource_params
        params.expect(epsilon_review_list_entry: [:kind, :value])
      end
    end
  end
end
