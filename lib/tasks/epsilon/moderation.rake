# frozen_string_literal: true

namespace :epsilon do
  namespace :moderation do
    desc 'Backfill the moderation events audit log from existing AI moderation records'
    task backfill_events: :environment do
      already = Epsilon::ModerationEvent.where.not(status_id: nil).pluck(:status_id).to_set
      count = 0

      Epsilon::AiStatusModeration.where(state: %i(approved manual_review rejected)).find_each do |moderation|
        next if already.include?(moderation.status_id)

        status = Status.unscoped.find_by(id: moderation.status_id)
        next if status.nil?

        metadata = status.epsilon_ai_metadata
        payload  = metadata&.mistral_payload || {}

        Epsilon::ModerationEvent.create!(
          account_id: status.account_id,
          acct: status.account&.acct,
          status_id: status.id,
          decision: moderation.state,
          sensitive: status.sensitive?,
          source: :llm,
          violence_score: metadata&.violence_score,
          vulgarity_score: payload['vulgarity_score'],
          sexual_score: payload['sexual_score'],
          category: payload['category'],
          trigger: payload['trigger'],
          created_at: moderation.created_at
        )
        count += 1
      end

      puts "Backfilled #{count} moderation event(s)."
    end

    desc 'Backfill the ai_content_warning flag from statuses still carrying the AI spoiler'
    task backfill_content_warnings: :environment do
      updated = Epsilon::AiStatusModeration
        .joins('INNER JOIN statuses s ON s.id = epsilon_ai_status_moderations.status_id')
        .where('s.sensitive = TRUE AND s.spoiler_text LIKE ?', "#{Epsilon::AiStatusModeration::AI_CW_SPOILER_PREFIX}%")
        .update_all(ai_content_warning: true)

      puts "Flagged #{updated} status(es) as AI content warnings."
    end
  end
end
