# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Epsilon::Categorization::CategoryMaster do
  describe 'validations' do
    it 'is valid with a name and a unique slug' do
      expect(Fabricate.build(:epsilon_category_master)).to be_valid
    end

    it 'requires a name' do
      category = Fabricate.build(:epsilon_category_master, name: nil)

      expect(category).to_not be_valid
      expect(category.errors[:name]).to include("can't be blank")
    end

    it 'requires a slug' do
      category = Fabricate.build(:epsilon_category_master, slug: nil)

      expect(category).to_not be_valid
      expect(category.errors[:slug]).to include("can't be blank")
    end

    it 'requires a unique slug' do
      Fabricate(:epsilon_category_master, slug: 'science')
      duplicate = Fabricate.build(:epsilon_category_master, slug: 'science')

      expect(duplicate).to_not be_valid
      expect(duplicate.errors[:slug]).to include('has already been taken')
    end
  end

  describe '.active' do
    it 'returns only active categories' do
      active = Fabricate(:epsilon_category_master, is_active: true)
      Fabricate(:epsilon_category_master, is_active: false)

      expect(described_class.active).to eq([active])
    end
  end

  describe '#display_name' do
    subject(:category) do
      Fabricate.build(:epsilon_category_master, name: 'Science', name_translations: { 'en' => 'Science', 'fr' => 'Sciences' })
    end

    it 'returns the translation for the requested locale' do
      expect(category.display_name(:fr)).to eq('Sciences')
    end

    it 'falls back to English when the locale is missing' do
      expect(category.display_name(:es)).to eq('Science')
    end

    it 'falls back to the canonical name when no translation exists' do
      category.name_translations = {}

      expect(category.display_name(:fr)).to eq('Science')
    end

    it 'ignores blank translations and falls back to English' do
      category.name_translations = { 'en' => 'Science', 'fr' => '' }

      expect(category.display_name(:fr)).to eq('Science')
    end

    it 'uses I18n.locale by default' do
      I18n.with_locale(:fr) do
        expect(category.display_name).to eq('Sciences')
      end
    end
  end

  describe 'associations' do
    it 'destroys dependent hashtag mappings' do
      category = Fabricate(:epsilon_category_master)
      Fabricate(:epsilon_hashtag_mapping, category_master: category)

      expect { category.destroy }.to change(Epsilon::Categorization::HashtagMapping, :count).by(-1)
    end
  end
end
