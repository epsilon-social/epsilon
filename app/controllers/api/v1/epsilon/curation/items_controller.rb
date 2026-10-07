# frozen_string_literal: true

module Api
  module V1
    class Epsilon::Curation::ItemsController < Api::BaseController
      READ_ACTIONS = %i(drafts memberships).freeze

      before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: READ_ACTIONS
      before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: READ_ACTIONS
      before_action :require_user!
      before_action :require_curation_permission!

      # Draft board of a feed: ordered items + their statuses (serialized once,
      # imported client-side so the studio reuses regular status entities).
      def drafts
        feed = ::Epsilon::Curation::CuratedFeed.find(params[:feed_id])
        items = feed.items.drafts_ordered.includes(:status).to_a
        statuses = preload_collection(items.map(&:status), Status)

        render json: {
          items: items.map { |item| item_payload(item) },
          statuses: serialized_statuses(statuses),
        }
      end

      def memberships
        status_ids = Array(params[:status_ids].presence || params[:status_id]).map(&:to_i)
        items = ::Epsilon::Curation::FeedItem.where(status_id: status_ids)
        render json: items.map { |item| item_payload(item) }
      end

      def create
        feed = ::Epsilon::Curation::CuratedFeed.find(params[:feed_id])
        status = Status.find(params[:status_id])

        return render json: { error: 'Only public, non-reblog statuses can be curated' }, status: 422 unless status.public_visibility? && !status.reblog?

        item = if params[:mode] == 'publish'
                 feed.add_published!(status, added_by: current_account)
               else
                 feed.add_draft!(status, added_by: current_account)
               end

        render json: item_payload(item)
      end

      def destroy
        item = ::Epsilon::Curation::FeedItem.find(params[:id])
        item.destroy!
        render_empty
      end

      def reorder
        feed = ::Epsilon::Curation::CuratedFeed.find(params[:id])
        feed.reorder_drafts!(Array(params.require(:item_ids)))
        render_empty
      end

      def publish
        feed = ::Epsilon::Curation::CuratedFeed.find(params[:id])
        render json: { published: feed.publish_drafts! }
      end

      private

      def require_curation_permission!
        render json: { error: 'This action is not allowed' }, status: 403 unless current_user.can?(:manage_taxonomies)
      end

      def item_payload(item)
        {
          id: item.id.to_s,
          curated_feed_id: item.curated_feed_id.to_s,
          status_id: item.status_id.to_s,
          state: item.state,
          position: item.position,
        }
      end

      def serialized_statuses(statuses)
        ActiveModelSerializers::SerializableResource.new(
          statuses,
          each_serializer: REST::StatusSerializer,
          relationships: StatusRelationshipsPresenter.new(statuses, current_account.id),
          scope: current_user,
          scope_name: :current_user
        ).as_json
      end
    end
  end
end
