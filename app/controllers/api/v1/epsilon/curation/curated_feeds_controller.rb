# frozen_string_literal: true

module Api
  module V1
    class Epsilon::Curation::CuratedFeedsController < Api::BaseController
      before_action -> { authorize_if_got_token! :read, :'read:statuses' }
      before_action :set_feed, only: [:statuses]
      after_action :insert_pagination_headers, only: [:statuses]

      def index
        cache_if_unauthenticated!
        # Staff curators also get draft / out-of-window feeds (badged in the
        # UI), so they can fill and preview a feed before it goes live.
        # Archived feeds stay hidden for everyone. Anonymous responses are the
        # cached, active-only list — staff is always authenticated.
        feeds = ::Epsilon::Curation::CuratedFeed.top_level.ordered.includes(:children)
        feeds = staff_curator? ? feeds.where.not(state: :archived) : feeds.currently_active
        counts = ::Epsilon::Curation::FeedItem.published.group(:curated_feed_id).count
        render json: feeds.map { |feed| feed_payload(feed, counts, with_children: true) }
      end

      def statuses
        cache_if_unauthenticated!
        # uniq: a status curated in two sibling sub-feeds would otherwise show
        # twice in the aggregating parent (page may then hold 19 instead of 20
        # — rare and accepted).
        @statuses = preload_collection(results.map(&:status).uniq(&:id), Status)
        render json: @statuses, each_serializer: REST::StatusSerializer, relationships: StatusRelationshipsPresenter.new(@statuses, current_user&.account_id)
      end

      private

      def set_feed
        # Staff bypass: preview the (published items of a) feed that is not
        # live yet — everyone else 404s on a non-active slug.
        scope = ::Epsilon::Curation::CuratedFeed.all
        scope = scope.currently_active unless staff_curator?
        @feed = scope.find_by!(slug: params[:slug])
      end

      def staff_curator?
        current_user&.can?(:manage_taxonomies)
      end

      def feed_payload(feed, counts, with_children: false)
        payload = {
          id: feed.id.to_s,
          slug: feed.slug,
          name: feed.name,
          name_translations: feed.name_translations,
          description_translations: feed.description_translations,
          icon: feed.icon,
          # Lets the staff UI badge non-live feeds; regular users only ever
          # receive currently-active (published) feeds anyway.
          state: feed.state,
          starts_at: feed.starts_at,
          ends_at: feed.ends_at,
          # Published items only — lets public surfaces (pills, sidebar, tabs)
          # hide feeds that have nothing to show yet.
          statuses_count: counts.fetch(feed.id, 0),
        }

        if with_children
          children = staff_curator? ? feed.children.reject(&:archived?) : feed.children.select(&:currently_active?)
          payload[:children] = children.sort_by { |child| [child.position, child.id] }.map { |child| feed_payload(child, counts) }
        end

        payload
      end

      # Feed items ordered by curation rank (position DESC, global counter),
      # cursor-paginated on `position` — the feed is deliberately NOT
      # chronological. A parent feed aggregates its children. `reorder` (not
      # `order`) is load-bearing: merging Status scopes drags in the Status
      # default_scope's chronological ORDER BY, which would otherwise take
      # precedence for signed-in viewers.
      def results
        @results ||= begin
          scope = ::Epsilon::Curation::FeedItem.published.where(curated_feed_id: @feed.self_and_children_ids).joins(status: :account).merge(Account.without_suspended.without_silenced)
          scope = scope.merge(Status.not_excluded_by_account(current_account)).merge(Status.not_domain_blocked_by_account(current_account)) if current_account
          scope = scope.where(position: ...params[:max_id].to_i) if params[:max_id].present?
          scope = scope.where(position: (min_position + 1)..) if min_position.present?
          scope.eager_load(:status).reorder(position: :desc).limit(limit_param(DEFAULT_STATUSES_LIMIT)).to_a
        end
      end

      def min_position
        (params[:since_id].presence || params[:min_id].presence)&.to_i
      end

      def insert_pagination_headers
        set_pagination_headers(next_path, prev_path)
      end

      def next_path
        api_v1_epsilon_curated_feed_statuses_url(@feed.slug, pagination_params(max_id: results.last.position)) if records_continue?
      end

      def prev_path
        api_v1_epsilon_curated_feed_statuses_url(@feed.slug, pagination_params(min_id: results.first.position)) unless results.empty?
      end

      def records_continue?
        results.size == limit_param(DEFAULT_STATUSES_LIMIT)
      end
    end
  end
end
