# frozen_string_literal: true

# The quotes list of a status (/api/v1/statuses/:id/quotes) filters results
# through StatusFilter -- except when the viewer is the quoted status' author,
# who got the raw list. A held (pending_ai) post quoting theirs would leak its
# content to them. Filter in SQL for every viewer instead.
module Epsilon::AiModerationQuotesControllerExtension
  private

  def default_statuses
    super.merge(Status.epsilon_without_pending_ai)
  end
end
