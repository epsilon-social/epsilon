# frozen_string_literal: true

module Api
  module V1
    class Epsilon::Curation::SearchController < Api::BaseController
      before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:category_statuses]
      before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:import_account]
      before_action :require_user!
      before_action :require_curation_permission!

      # Public statuses of a fork category (curation studio "by category" search
      # mode) — account / hashtag / URL modes go through native endpoints.
      def category_statuses
        statuses = Status.with_category(params[:category_id])
          .merge(Status.public_visibility)
          .where(reblog_of_id: nil)
          .to_a_paginated_by_id(limit_param(DEFAULT_STATUSES_LIMIT), params_slice(:max_id, :since_id, :min_id))

        statuses = preload_collection(statuses, Status)
        render json: statuses, each_serializer: REST::StatusSerializer, relationships: StatusRelationshipsPresenter.new(statuses, current_account.id)
      end

      # Imports the recent public history of a remote account by reading its
      # ActivityPub outbox (the studio only knows statuses already in the local
      # database otherwise).
      def import_account
        account = Account.find(params[:account_id])

        return render json: { error: 'Only remote accounts can be imported' }, status: 422 if account.local?

        Epsilon::Curation::FetchOutboxWorker.perform_async(account.id)
        render json: { queued: true }, status: 202
      end

      private

      def require_curation_permission!
        render json: { error: 'This action is not allowed' }, status: 403 unless current_user.can?(:manage_taxonomies)
      end
    end
  end
end
