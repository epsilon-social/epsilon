# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::AccountCategoryOverride do
  it 'is valid with an account and a category' do
    expect(Fabricate.build(:epsilon_account_category_override)).to be_valid
  end

  it 'uses account_id as its primary key' do
    expect(described_class.primary_key).to eq('account_id')
  end

  it 'belongs to an account and a category' do
    override = Fabricate(:epsilon_account_category_override)

    expect(override.account).to be_present
    expect(override.category_master).to be_present
  end
end
