# frozen_string_literal: true

namespace :epsilon do
  namespace :curated_feeds do
    desc 'Seed the initial curated editorial feeds (idempotent, non-destructive)'
    task seed: :environment do
      feeds = [
        { slug: 'discover', legacy_slug: 'decouverte', en: 'Discovery', fr: 'Découverte', position: 0, parent: nil },
        { slug: 'world', legacy_slug: 'monde', en: 'World', fr: 'Monde', position: 1, parent: 'discover' },
      ]

      created = 0
      renamed = 0

      feeds.each do |attrs|
        # Environments seeded before the English-slug switch get their feed
        # renamed in place (items, ids and translations untouched).
        legacy = attrs[:legacy_slug] && Epsilon::Curation::CuratedFeed.find_by(slug: attrs[:legacy_slug])

        if legacy && !Epsilon::Curation::CuratedFeed.exists?(slug: attrs[:slug])
          legacy.update!(slug: attrs[:slug])
          renamed += 1
        end

        # Only creates missing feeds (matched by slug). Existing ones are left
        # untouched — curated items are never altered by re-running the seed.
        parent = attrs[:parent] && Epsilon::Curation::CuratedFeed.find_by!(slug: attrs[:parent])

        record = Epsilon::Curation::CuratedFeed.find_or_create_by!(slug: attrs[:slug]) do |feed|
          feed.name = attrs[:en]
          feed.name_translations = { 'en' => attrs[:en], 'fr' => attrs[:fr] }
          feed.position = attrs[:position]
          feed.state = :published
          feed.parent = parent
        end

        created += 1 if record.previously_new_record?
      end

      puts "Done! #{created} curated feeds created, #{renamed} renamed to English slugs, #{feeds.size - created - renamed} already up to date."
    end

    desc 'Re-cache the remote media of published curated items (fixes /media_proxy 429 storms)'
    task redownload_media: :environment do
      enqueued = 0

      MediaAttachment.remote
        .where(status_id: Epsilon::Curation::FeedItem.published.select(:status_id), file_file_name: nil)
        .in_batches do |batch|
        batch.pluck(:id).each do |attachment_id|
          RedownloadMediaWorker.perform_async(attachment_id)
          enqueued += 1
        end
      end

      puts "Done! #{enqueued} media redownloads enqueued on the 'pull' queue."
    end
  end
end
