# frozen_string_literal: true

class PublicFeed
  # @param [Account] account
  # @param [Hash] options
  # @option [Boolean] :with_replies
  # @option [Boolean] :with_reblogs
  # @option [Boolean] :local
  # @option [Boolean] :remote
  # @option [Boolean] :only_media
  # @option [Symbol] :sensitive_scope (:media, :cw, :all)
  # @option [Array<Integer>] :category_ids
  def initialize(account, options = {})
    @account = account
    @options = options
  end

  # @param [Integer] limit
  # @param [Integer] max_id
  # @param [Integer] since_id
  # @param [Integer] min_id
  # @return [Array<Status>]
  def get(limit, max_id = nil, since_id = nil, min_id = nil)
    return [] if incompatible_feed_settings?

    scope = public_scope

    scope.merge!(without_replies_scope) unless with_replies?
    scope.merge!(without_reblogs_scope) unless with_reblogs?
    scope.merge!(local_only_scope) if local_only?
    scope.merge!(remote_only_scope) if remote_only?
    scope.merge!(account_filters_scope) if account?
    scope.merge!(media_only_scope) if media_only?
    # EPSILON : MODERATION LIVE FEED FILTER
    scope.merge!(sensitive_scope_filter) if sensitive_scope?
    # EPSILON : MODERATION CATEGORY FEED FILTER
    scope.merge!(category_filter_scope) if category_filter?
    scope.merge!(language_scope) if account&.chosen_languages.present?

    scope.to_a_paginated_by_id(limit, max_id: max_id, since_id: since_id, min_id: min_id)
  end

  private

  attr_reader :account, :options

  def incompatible_feed_settings?
    (local_only? && !user_has_access_to_feed?(local_feed_setting)) || (remote_only? && !user_has_access_to_feed?(remote_feed_setting))
  end

  def user_has_access_to_feed?(setting)
    case setting
    when 'public'
      true
    when 'authenticated'
      @account&.user&.functional?
    when 'disabled'
      @account&.user&.can?(:view_feeds)
    end
  end

  def with_reblogs?
    options[:with_reblogs]
  end

  def with_replies?
    options[:with_replies]
  end

  def local_feed_setting
    Setting.local_live_feed_access
  end

  def remote_feed_setting
    Setting.remote_live_feed_access
  end

  def local_only?
    (options[:local] && !options[:remote]) || !user_has_access_to_feed?(remote_feed_setting)
  end

  def remote_only?
    (options[:remote] && !options[:local]) || !user_has_access_to_feed?(local_feed_setting)
  end

  def account?
    account.present?
  end

  def media_only?
    options[:only_media]
  end

  # ==========================================
  # EPSILON : MODERATION LIVE FEED FILTER
  # ==========================================
  def sensitive_scope?
    options[:sensitive_scope].present?
  end
  # ==========================================

  # ==========================================
  # EPSILON : MODERATION CATEGORY FEED FILTER
  # ==========================================
  def category_filter?
    options[:category_ids].present?
  end
  # ==========================================

  def public_scope
    Status.public_visibility.joins(:account).merge(Account.without_suspended.without_silenced)
  end

  def local_only_scope
    Status.local
  end

  def remote_only_scope
    Status.remote
  end

  def without_replies_scope
    Status.without_replies
  end

  def without_reblogs_scope
    Status.without_reblogs
  end

  def media_only_scope
    Status.joins(:media_attachments).group(:id)
  end

  # ==========================================
  # EPSILON : MODERATION LIVE FEED FILTER
  # All three predicates are covered by the partial index
  # `index_statuses_epsilon_sensitive_id` (WHERE sensitive OR spoiler_text <> ''):
  # the :media and :cw subsets are implied by it, so it stays usable → O(limit).
  # ==========================================
  def sensitive_scope_filter
    case options[:sensitive_scope]
    when :media
      Status.where('statuses.sensitive')
    when :cw
      Status.where("statuses.spoiler_text <> ''")
    else
      Status.where("statuses.sensitive OR statuses.spoiler_text <> ''")
    end
  end
  # ==========================================

  # ==========================================
  # EPSILON : MODERATION CATEGORY FEED FILTER
  # EXISTS instead of a JOIN: a post can belong to several of the selected
  # categories, and EXISTS keeps the scope duplicate-free without a DISTINCT.
  # Covered by the partial index `idx_epsilon_lpc_category_status_validated`
  # (category_master_id, status_id DESC WHERE is_validated).
  # ==========================================
  def category_filter_scope
    categorizations = Epsilon::Categorization::LocalPostCategorization
      .validated
      .where(category_master_id: options[:category_ids])
      .where(Epsilon::Categorization::LocalPostCategorization.arel_table[:status_id].eq(Status.arel_table[:id]))

    Status.where(categorizations.arel.exists)
  end
  # ==========================================

  def language_scope
    Status.where(language: account.chosen_languages)
  end

  def account_filters_scope
    Status.not_excluded_by_account(account).tap do |scope|
      scope.merge!(Status.not_domain_blocked_by_account(account)) unless local_only?
    end
  end
end
