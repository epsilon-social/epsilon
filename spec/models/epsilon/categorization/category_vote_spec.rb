# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::CategoryVote do
  describe 'validations' do
    it 'is valid with a status, an account and a category' do
      expect(Fabricate.build(:epsilon_category_vote)).to be_valid
    end

    it 'prevents an account from voting twice for the same status and category' do
      account = Fabricate(:account)
      status = Fabricate(:status)
      category = Fabricate(:epsilon_category_master)
      Fabricate(:epsilon_category_vote, account: account, status: status, category_master: category)
      duplicate = Fabricate.build(:epsilon_category_vote, account: account, status: status, category_master: category)

      expect(duplicate).to_not be_valid
    end

    it 'allows the same account to vote for the same status in another category' do
      account = Fabricate(:account)
      status = Fabricate(:status)
      Fabricate(:epsilon_category_vote, account: account, status: status)
      other = Fabricate.build(:epsilon_category_vote, account: account, status: status)

      expect(other).to be_valid
    end
  end
end
