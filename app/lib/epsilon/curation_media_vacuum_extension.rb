# frozen_string_literal: true

# Curated feeds deliberately resurface posts long past the remote-media cache
# retention period. If the vacuum purges their files, every render falls back
# to /media_proxy, which is natively throttled (30 req / 30 min / IP) because
# each hit re-downloads from the origin — the feed page then 429s for every
# visitor. Keep the media of published curated items out of the purge.
module Epsilon::CurationMediaVacuumExtension
  private

  def media_attachments_past_retention_period
    super.where.not(status_id: Epsilon::Curation::FeedItem.published.select(:status_id))
  end
end
