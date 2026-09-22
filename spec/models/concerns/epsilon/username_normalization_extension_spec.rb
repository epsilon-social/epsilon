# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::UsernameNormalizationExtension do
  describe 'local username normalization (on validation)' do
    def normalized(username)
      account = Account.new(username: username, domain: nil)
      account.valid?
      account.username
    end

    it 'removes a space in the middle of the username' do
      expect(normalized('jean dupont')).to eq 'jeandupont'
    end

    it 'removes leading and trailing whitespace' do
      expect(normalized('  bob  ')).to eq 'bob'
    end

    it 'removes tabs and newlines' do
      expect(normalized("jean\tdu\npont")).to eq 'jeandupont'
    end

    it 'removes non-breaking spaces (U+00A0)' do
      expect(normalized("jean\u00A0dupont")).to eq 'jeandupont'
    end

    it 'leaves a whitespace-free username untouched' do
      expect(normalized('normal_user')).to eq 'normal_user'
    end

    it 'lets a local account with an internal space validate instead of erroring' do
      account = Fabricate.build(:account, domain: nil, username: 'jean dupont')

      expect(account).to be_valid
      expect(account.username).to eq 'jeandupont'
    end
  end

  describe 'remote usernames' do
    it 'keeps core behaviour and does not strip internal whitespace' do
      account = Account.new(username: 'jean dupont', domain: 'remote.tld')
      account.valid?

      expect(account.username).to eq 'jean dupont'
    end
  end
end
