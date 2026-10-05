# frozen_string_literal: true

# The oEmbed endpoint only checked Status#hidden? (visibility), so a *public*
# status held for AI moderation leaked its content through
# /api/oembed?url=... without ever hitting StatusPolicy. The endpoint is
# anonymous, so there is no author/staff nuance: a held status is simply not
# embeddable yet.
module Epsilon::AiModerationOEmbedControllerExtension
  private

  def require_public_status!
    return not_found if @status.pending_ai?

    super
  end
end
