# frozen_string_literal: true

class Api::V1::Timelines::PublicController < Api::V1::Timelines::BaseController
  before_action -> { authorize_if_got_token! :read, :'read:statuses' }
  before_action :require_user!, if: :require_auth?

  # ==========================================
  # EPSILON : MODERATION LIVE FEED FILTER
  # `sensitive_scope` (media | cw | all): returns only posts with sensitive
  # media, and/or a content warning (moderation tool, moderators only).
  # ==========================================
  PERMITTED_PARAMS = %i(local remote limit only_media sensitive_scope).freeze
  # EPSILON : MODERATION LIVE FEED FILTER — accepted values for `sensitive_scope`
  SENSITIVE_SCOPES = { 'media' => :media, 'cw' => :cw, 'all' => :all }.freeze
  # ==========================================
  # EPSILON : MODERATION CATEGORY FEED FILTER
  # `category_ids[]`: returns only posts categorized into at least one of the
  # given categories (moderation tool, moderators only). Hard cap as a
  # defensive bound on the IN list.
  # ==========================================
  MAX_FILTER_CATEGORY_IDS = 50

  def show
    cache_if_unauthenticated!
    @statuses = load_statuses
    render json: @statuses, each_serializer: REST::StatusSerializer, relationships: StatusRelationshipsPresenter.new(@statuses, current_user&.account_id)
  end

  private

  def require_auth?
    if truthy_param?(:local)
      Setting.local_live_feed_access != 'public'
    elsif truthy_param?(:remote)
      Setting.remote_live_feed_access != 'public'
    else
      Setting.local_live_feed_access != 'public' || Setting.remote_live_feed_access != 'public'
    end
  end

  def load_statuses
    preloaded_public_statuses_page
  end

  def preloaded_public_statuses_page
    preload_collection(public_statuses, Status)
  end

  def public_statuses
    public_feed.get(
      limit_param(DEFAULT_STATUSES_LIMIT),
      params[:max_id],
      params[:since_id],
      params[:min_id]
    )
  end

  def public_feed
    PublicFeed.new(
      current_account,
      local: truthy_param?(:local),
      remote: truthy_param?(:remote),
      only_media: truthy_param?(:only_media),
      # EPSILON : MODERATION LIVE FEED FILTER
      sensitive_scope: sensitive_moderation_scope,
      # EPSILON : MODERATION CATEGORY FEED FILTER
      category_ids: moderation_category_ids
    )
  end

  # ==========================================
  # EPSILON : MODERATION LIVE FEED FILTER
  # Server-side guard (defense in depth): the moderation filter is honored for
  # moderators only (manage_reports = Moderator/Admin/Owner). For anyone else it
  # returns nil (no filter) — the returned posts are public anyway, so this gates
  # the capability, not data. Mirrors the UI gate in the Firehose.
  # Returns :media, :cw, :all, or nil.
  # ==========================================
  def sensitive_moderation_scope
    return unless current_user&.can?(:manage_reports)

    SENSITIVE_SCOPES[params[:sensitive_scope]]
  end
  # ==========================================

  # ==========================================
  # EPSILON : MODERATION CATEGORY FEED FILTER
  # Same server-side guard as the sensitive filter: honored for moderators
  # only (manage_reports), gates the capability, not data (posts are public).
  # Returns an array of integer ids, or nil (no filter).
  # ==========================================
  def moderation_category_ids
    return unless current_user&.can?(:manage_reports)

    Array(params[:category_ids])
      .take(MAX_FILTER_CATEGORY_IDS)
      .filter_map { |id| Integer(id, exception: false) }
      .presence
  end

  # EPSILON : MODERATION CATEGORY FEED FILTER — carry the filter over into the
  # next/prev pagination links (PERMITTED_PARAMS only handles scalar params).
  def permitted_params
    category_ids = moderation_category_ids

    category_ids ? super.merge(category_ids: category_ids) : super
  end
  # ==========================================

  def next_path
    api_v1_timelines_public_url next_path_params
  end

  def prev_path
    api_v1_timelines_public_url prev_path_params
  end
end
