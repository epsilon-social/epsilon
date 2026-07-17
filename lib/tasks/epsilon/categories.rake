# frozen_string_literal: true

namespace :epsilon do
  namespace :categories do
    desc 'Seed the official Epsilon categories with EN + FR names (idempotent, non-destructive)'
    task seed: :environment do
      # The 23 official Epsilon categories (slug + English/French names).
      categories = [
        { slug: 'news', en: 'News', fr: 'Actualités' },
        { slug: 'politics', en: 'Politics', fr: 'Politique' },
        { slug: 'economy', en: 'Economy', fr: 'Économie' },
        { slug: 'finance', en: 'Finance', fr: 'Finance' },
        { slug: 'technology', en: 'Technology', fr: 'Technologie' },
        { slug: 'science', en: 'Science', fr: 'Sciences' },
        { slug: 'health', en: 'Health', fr: 'Santé' },
        { slug: 'education', en: 'Education', fr: 'Éducation' },
        { slug: 'history', en: 'History', fr: 'Histoire' },
        { slug: 'environment', en: 'Environment', fr: 'Environnement' },
        { slug: 'nature', en: 'Nature', fr: 'Nature' },
        { slug: 'animals', en: 'Animals', fr: 'Animaux' },
        { slug: 'sports', en: 'Sports', fr: 'Sport' },
        { slug: 'gaming', en: 'Gaming', fr: 'Jeux vidéo' },
        { slug: 'cinema', en: 'Cinema', fr: 'Cinéma' },
        { slug: 'music', en: 'Music', fr: 'Musique' },
        { slug: 'literature', en: 'Books & Literature', fr: 'Livres & Littérature' },
        { slug: 'art', en: 'Art', fr: 'Art' },
        { slug: 'photography', en: 'Photography', fr: 'Photographie' },
        { slug: 'fashion_beauty', en: 'Fashion & Beauty', fr: 'Mode & Beauté' },
        { slug: 'food', en: 'Food', fr: 'Cuisine' },
        { slug: 'travel', en: 'Travel', fr: 'Voyage' },
        { slug: 'automotive', en: 'Automotive & Mobility', fr: 'Automobile & Mobilité' },
      ]

      created = 0

      categories.each do |cat|
        # Only creates missing categories (matched by slug). Existing ones are
        # left untouched — no data (mappings, subscriptions…) is ever deleted.
        record = Epsilon::Categorization::CategoryMaster.find_or_create_by!(slug: cat[:slug]) do |c|
          c.name = cat[:en]
          c.name_translations = { 'en' => cat[:en], 'fr' => cat[:fr] }
          c.is_active = true
        end

        created += 1 if record.previously_new_record?
      end

      puts "Done! #{created} categories created, #{categories.size - created} already existed (left untouched)."
    end

    desc 'Reshape an existing DB: rename, merge hashtags, delete (idempotent, preserves data)'
    task reshape: :environment do
      # old slug => new slug + names
      renames = {
        'art_design' => { slug: 'art', en: 'Art', fr: 'Art' },
        'food_gastronomy' => { slug: 'food', en: 'Food', fr: 'Cuisine' },
        'movies_tv' => { slug: 'cinema', en: 'Cinema', fr: 'Cinéma' },
        'photography_video' => { slug: 'photography', en: 'Photography', fr: 'Photographie' },
        'home_garden' => { slug: 'nature', en: 'Nature', fr: 'Nature' },
        'business_career' => { slug: 'finance', en: 'Finance', fr: 'Finance' },
      }

      # source slug => target slug (source hashtags move to target, source deleted)
      merges = {
        'philosophy' => 'literature',
        'space' => 'science',
        'family_lifestyle' => 'fashion_beauty',
      }

      # removed outright
      deletions = %w(religion entertainment humor_memes hobbies)

      master = Epsilon::Categorization::CategoryMaster
      mapping = Epsilon::Categorization::HashtagMapping

      ActiveRecord::Base.transaction do
        renames.each do |old_slug, info|
          category = master.find_by(slug: old_slug)
          next unless category

          category.update!(slug: info[:slug], name: info[:en], name_translations: { 'en' => info[:en], 'fr' => info[:fr] })
          puts "Renamed #{old_slug} -> #{info[:slug]}"
        end

        merges.each do |source_slug, target_slug|
          source = master.find_by(slug: source_slug)
          target = master.find_by(slug: target_slug)
          next unless source && target

          moved = 0
          mapping.where(category_master_id: source.id).find_each do |m|
            if mapping.exists?(category_master_id: target.id, hashtag: m.hashtag)
              m.destroy!
            else
              m.update!(category_master_id: target.id)
            end
            moved += 1
          end

          source.destroy!
          puts "Merged #{source_slug} -> #{target_slug} (#{moved} hashtags moved), deleted #{source_slug}"
        end

        deletions.each do |slug|
          category = master.find_by(slug: slug)
          next unless category

          category.destroy!
          puts "Deleted #{slug}"
        end
      end

      puts "Reshape done. #{master.count} categories remain."
    end
  end
end
