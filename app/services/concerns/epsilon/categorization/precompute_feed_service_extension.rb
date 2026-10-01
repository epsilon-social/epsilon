# frozen_string_literal: true

module Epsilon::Categorization::PrecomputeFeedServiceExtension
  # Native feed regeneration rebuilds the home feed from follows only. Without
  # this, an eviction (feeds vacuum on inactive users) or a post-inactivity
  # sign-in leaves a categories-only user with an empty feed. Re-enqueue the
  # category backfills once the native rebuild is done (the worker is
  # idempotent: zadd + home filtering).
  def call(account, **options)
    super
  ensure
    account.category_subscriptions.pluck(:category_master_id).each do |category_master_id|
      Epsilon::Categorization::SubscribeBackfillWorker.perform_async(account.id, category_master_id)
    end
  end
end
