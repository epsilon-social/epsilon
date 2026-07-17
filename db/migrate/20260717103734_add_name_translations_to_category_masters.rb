# frozen_string_literal: true

class AddNameTranslationsToCategoryMasters < ActiveRecord::Migration[8.1]
  FR_NAMES = {
    'animals' => 'Animaux',
    'art_design' => 'Art & Design',
    'automotive' => 'Automobile & Mobilité',
    'business_career' => 'Business & Carrière',
    'economy' => 'Économie',
    'education' => 'Éducation',
    'entertainment' => 'Divertissement',
    'environment' => 'Environnement',
    'family_lifestyle' => 'Famille & Lifestyle',
    'fashion_beauty' => 'Mode & Beauté',
    'food_gastronomy' => 'Cuisine & Gastronomie',
    'gaming' => 'Jeux vidéo',
    'health' => 'Santé',
    'history' => 'Histoire',
    'hobbies' => 'Loisirs & Passions',
    'home_garden' => 'Maison & Jardin',
    'humor_memes' => 'Humour & Mèmes',
    'literature' => 'Livres & Littérature',
    'movies_tv' => 'Cinéma & TV',
    'music' => 'Musique',
    'news' => 'Actualités',
    'philosophy' => 'Philosophie',
    'photography_video' => 'Photographie & Vidéo',
    'politics' => 'Politique',
    'religion' => 'Religion & Spiritualité',
    'science' => 'Sciences',
    'space' => 'Espace & Astronomie',
    'sports' => 'Sport',
    'technology' => 'Technologie',
    'travel' => 'Voyage',
  }.freeze

  # Lightweight local model so the backfill does not depend on the real model.
  class CategoryMaster < ApplicationRecord
    self.table_name = 'category_masters'
  end

  def up
    add_column :category_masters, :name_translations, :jsonb, null: false, default: {}

    CategoryMaster.reset_column_information

    CategoryMaster.find_each do |category|
      category.update_columns(
        name_translations: {
          'en' => category.name,
          'fr' => FR_NAMES.fetch(category.slug, category.name),
        }
      )
    end
  end

  def down
    remove_column :category_masters, :name_translations
  end
end
