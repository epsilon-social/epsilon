# frozen_string_literal: true

class Epsilon::Curation::FetchOutboxWorker
  include Sidekiq::Worker

  sidekiq_options queue: 'pull', retry: 1, lock: :until_executed

  def perform(account_id)
    account = Account.find_by(id: account_id)
    return if account.nil?

    Epsilon::Curation::FetchOutboxService.new.call(account)
  end
end
