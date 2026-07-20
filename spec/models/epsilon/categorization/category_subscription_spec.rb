# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::CategorySubscription do
  describe 'validations' do
    it 'is valid with an account and a category' do
      expect(Fabricate.build(:epsilon_category_subscription)).to be_valid
    end

    it 'prevents the same account from subscribing twice to a category' do
      account = Fabricate(:account)
      category = Fabricate(:epsilon_category_master)
      Fabricate(:epsilon_category_subscription, account: account, category_master: category)
      duplicate = Fabricate.build(:epsilon_category_subscription, account: account, category_master: category)

      expect(duplicate).to_not be_valid
    end
  end

  describe 'counter cache' do
    it 'increments category_subscriptions_count when created' do
      category = Fabricate(:epsilon_category_master)

      expect { Fabricate(:epsilon_category_subscription, category_master: category) }
        .to change { category.reload.category_subscriptions_count }.by(1)
    end

    it 'decrements category_subscriptions_count when destroyed' do
      category = Fabricate(:epsilon_category_master)
      subscription = Fabricate(:epsilon_category_subscription, category_master: category)

      expect { subscription.destroy }
        .to change { category.reload.category_subscriptions_count }.by(-1)
    end
  end
end
