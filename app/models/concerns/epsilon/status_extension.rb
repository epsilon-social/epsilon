# frozen_string_literal: true

module Epsilon::StatusExtension
  extend ActiveSupport::Concern

  included do
    self.ignored_columns += %w(moderation_state)

    attr_accessor :epsilon_bypass_ai

    has_one :epsilon_ai_metadata, class_name: '::Epsilon::AiMetadata', dependent: :destroy

    has_one :epsilon_ai_status_moderation, class_name: '::Epsilon::AiStatusModeration', inverse_of: :status, dependent: :destroy

    delegate :unmoderated?, :pending_ai?, :approved?, :manual_review?, :rejected?,
             to: :epsilon_ai_status_moderation_or_default

    # Excludes statuses still held for AI moderation -- and reblogs whose
    # target is held, so a boost cannot resurface the content of a post that
    # went back to pending_ai (edit re-moderation). The held set is tiny and
    # covered by the partial index index_epsilon_ai_moderations_pending_status_id,
    # so both correlated NOT EXISTS probes stay cheap on hot read paths.
    scope :epsilon_without_pending_ai, lambda {
      pending     = ::Epsilon::AiStatusModeration.pending_ai
      held_self   = pending.where(pending.arel_table[:status_id].eq(arel_table[:id]))
      held_target = pending.where(pending.arel_table[:status_id].eq(arel_table[:reblog_of_id]))

      where.not(held_self.arel.exists).where.not(held_target.arel.exists)
    }

    before_create :epsilon_set_pending_ai_state, if: :epsilon_requires_moderation?
    after_create_commit :epsilon_trigger_remote_ai_moderation, if: :pending_ai?
  end

  def epsilon_ai_status_moderation_or_default
    epsilon_ai_status_moderation || build_epsilon_ai_status_moderation(state: :unmoderated)
  end

  def moderation_state
    epsilon_ai_status_moderation_or_default.state
  end

  private

  def epsilon_requires_moderation?
    return false if Rails.env.test? && ENV.fetch('TEST_EPSILON_AI', 'false') != 'true'
    return false unless ::Epsilon::AiModerationSetting.current.ai_enabled?
    return false if epsilon_bypass_ai
    return false if local? && account&.user&.role&.can?(:manage_reports)
    return false if reblog?

    # Private messages (direct visibility) are never sent to AI moderation --
    # scanning one-to-one private conversations is off-limits. This is the single
    # funnel, so it covers edits too (the edit path delegates here).
    return false if direct_visibility?

    full_text = [text, spoiler_text].join(' ').strip
    return false if full_text.blank?

    return true if local?

    return true if epsilon_reply_to_local?
    return true if epsilon_reblog_of_local?
    return true if epsilon_quote_of_local?
    return true if epsilon_mentions_local?

    false
  end

  def epsilon_reply_to_local?
    in_reply_to_account_id.present? && Account.exists?(id: in_reply_to_account_id, domain: nil)
  end

  def epsilon_reblog_of_local?
    reblog_of_id.present? &&
      Account.exists?(id: Status.select(:account_id).where(id: reblog_of_id), domain: nil)
  end

  def epsilon_quote_of_local?
    respond_to?(:quote_id) && quote_id.present? &&
      Account.exists?(id: Status.select(:account_id).where(id: quote_id), domain: nil)
  end

  def epsilon_mentions_local?
    full_text = [text, spoiler_text].join(' ')
    return false if full_text.blank?

    domain = Rails.configuration.x.web_domain || Rails.configuration.x.local_domain

    base_domain = domain.to_s.split(':').first
    return true if base_domain.present? && full_text.include?(base_domain)

    if defined?(Account::MENTION_RE)
      local_usernames = full_text.scan(Account::MENTION_RE).filter_map do |match|
        username = match[0]
        domain_part = match[1]

        username if domain_part.nil? || domain_part == domain
      end.uniq

      return true if local_usernames.any? && Account.exists?(username: local_usernames, domain: nil)
    end

    false
  end

  def epsilon_set_pending_ai_state
    build_epsilon_ai_status_moderation(state: :pending_ai)
  end

  def epsilon_trigger_remote_ai_moderation
    Epsilon::MistralModerationWorker.perform_async(id)
  end
end
