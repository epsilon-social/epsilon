# frozen_string_literal: true

# Imports the recent public history of a remote account by walking its
# ActivityPub outbox, so the curation studio has material to pick from even
# when nobody local follows the account yet. Mirrors the shape of
# ActivityPub::FetchFeaturedCollectionService (signed collection fetch →
# per-item import through FetchRemoteStatusService).
class Epsilon::Curation::FetchOutboxService < BaseService
  include JsonLdHelper

  MAX_PAGES    = 2
  MAX_STATUSES = 20

  def call(account, request_id: nil)
    return if account.local? || account.suspended? || account.outbox_url.blank?

    @account    = account
    @request_id = request_id

    items, = collection_items(account.outbox_url, max_pages: MAX_PAGES, max_items: MAX_STATUSES * 2, reference_uri: account.uri, on_behalf_of: local_follower)
    process_items(items)
  end

  private

  def process_items(items)
    return 0 if items.nil?

    imported = 0

    items.each do |item|
      break if imported >= MAX_STATUSES
      next unless item.is_a?(Hash) && item['type'] == 'Create'

      uri = value_or_id(item['object'])
      next if uri.blank? || ActivityPub::TagManager.instance.local_uri?(uri) || non_matching_uri_hosts?(@account.uri, uri)

      status = ActivityPub::FetchRemoteStatusService.new.call(uri, on_behalf_of: local_follower, expected_actor_uri: @account.uri, request_id: @request_id)
      imported += 1 if status.present?
    rescue ActiveRecord::RecordInvalid, Mastodon::UnexpectedResponseError => e
      Rails.logger.debug { "Epsilon curation: skipped outbox item of #{@account.acct}: #{e.message}" }
    end

    imported
  end

  def local_follower
    return @local_follower if defined?(@local_follower)

    @local_follower = @account.followers.local.without_suspended.first
  end
end
