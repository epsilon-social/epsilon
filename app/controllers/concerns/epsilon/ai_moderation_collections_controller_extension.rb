# frozen_string_literal: true

# The ActivityPub featured collection embeds pinned statuses as full objects
# (distributable? bypasses per-item authorization), so an author pinning their
# own held (pending_ai) post would federate its content despite the
# distribution hold. Drop held items entirely -- not even their URI should be
# advertised before the verdict.
module Epsilon::AiModerationCollectionsControllerExtension
  private

  def set_items
    super

    @items = @items.reject { |item| item.is_a?(Status) && item.pending_ai? } if @items.present?
  end
end
