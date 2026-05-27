# frozen_string_literal: true

require 'rails_helper'
require 'rake'

# rubocop:disable RSpec/DescribeClass
RSpec.describe 'epsilon:setup_sentinel' do
  # rubocop:enable RSpec/DescribeClass

  before do
    Rails.application.load_tasks if Rake::Task.tasks.empty?
    Rake::Task['epsilon:setup_sentinel'].reenable

    allow($stdout).to receive(:puts)
  end

  context 'when the sentinel does not exist' do
    before do
      Fabricate(:user_role, name: 'Moderator')

      account = Account.find_by(username: 'EpsilonSafety', domain: nil)
      if account
        account.user&.destroy
        account.destroy
      end
    end

    it 'creates the EpsilonSafety account and user with a role' do
      expect { Rake::Task['epsilon:setup_sentinel'].invoke }
        .to change(Account, :count).by(1)
        .and change(User, :count).by(1)

      account = Account.find_by(username: 'EpsilonSafety', domain: nil)
      expect(account).to be_present
      expect(account.bot).to be true
      expect(account.actor_type).to eq('Application')
      expect(account.user.role.name).to eq('Moderator')
    end
  end

  context 'when the sentinel already exists' do
    before do
      unless Account.exists?(username: 'EpsilonSafety', domain: nil)
        account = Fabricate(:account, username: 'EpsilonSafety', domain: nil)
        Fabricate(:user, account: account, email: "epsilonsafety@#{Rails.configuration.x.local_domain || 'localhost'}")
      end
    end

    it 'does not create a new account or user' do
      previous_account_count = Account.count
      previous_user_count = User.count

      Rake::Task['epsilon:setup_sentinel'].invoke

      expect(Account.count).to eq(previous_account_count)
      expect(User.count).to eq(previous_user_count)
      expect($stdout).to have_received(:puts).with(/already exists/)
    end
  end
end
