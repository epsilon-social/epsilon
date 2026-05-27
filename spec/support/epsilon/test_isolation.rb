# frozen_string_literal: true

RSpec.configure do |config|
  config.before(:suite) do
    account = Account.find_by(username: 'EpsilonSafety', domain: nil)
    next unless account

    account.user&.destroy
    account.destroy
  end
end
