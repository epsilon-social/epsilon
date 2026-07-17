# frozen_string_literal: true

namespace :epsilon do
  namespace :hashtags do
    desc 'Import hashtag mappings from YAML and report multi-category overlaps'
    task seed: :environment do
      file_path = Rails.root.join('config', 'epsilon', 'hashtag_seeds.yml')
      abort("❌ Fil not found : #{file_path}") unless File.exist?(file_path)

      mappings = YAML.load_file(file_path) || {}
      added_count = 0
      overlap_tracker = Hash.new { |hash, key| hash[key] = [] }

      puts 'Mapping hashtags importation...'

      ActiveRecord::Base.transaction do
        mappings.each do |category_slug, hashtags|
          category = Epsilon::Categorization::CategoryMaster.find_by(slug: category_slug)

          unless category
            puts "Category not found (in DB) : #{category_slug}"
            next
          end

          clean_tags = Array(hashtags).map { |t| HashtagNormalizer.new.normalize(t.to_s) }.compact_blank.uniq

          clean_tags.each do |tag|
            overlap_tracker[tag] << category_slug

            mapping = Epsilon::Categorization::HashtagMapping.find_or_create_by!(
              hashtag: tag,
              category_master_id: category.id
            )

            added_count += 1 if mapping.previously_new_record?
          end
        end
      end

      puts "Done ! #{added_count} new relations."

      overlaps = overlap_tracker.select { |_tag, categories| categories.size > 1 }

      if overlaps.any?
        puts "\nMulti-Category Hashtags Found (Many-to-Many) :"
        overlaps.each do |tag, categories|
          puts "  - ##{tag} link to : #{categories.join(', ')}"
        end
      end
    end
  end
end
