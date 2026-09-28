# frozen_string_literal: true

namespace :epsilon do
  namespace :categorization do
    desc 'Enqueue categorization for local statuses never categorized (arg: window in days, default 30) — rake epsilon:categorization:backfill_local[30]'
    task :backfill_local, [:days] => :environment do |_t, args|
      days = (args[:days] || 30).to_i

      scope = Status.local
        .where(reblog_of_id: nil)
        .where(created_at: days.days.ago..)
        .where.not(id: Epsilon::Categorization::LocalPostCategorization.select(:status_id))

      total = 0

      scope.in_batches(of: 1_000) do |batch|
        ids = batch.ids
        Epsilon::Categorization::CategorizeStatusWorker.push_bulk(ids)
        total += ids.size
      end

      puts "Enqueued categorization for #{total} local status(es) from the last #{days} day(s)."
    end
  end
end
