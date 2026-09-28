# frozen_string_literal: true

module Epsilon::Categorization::PostStatusExtension
  # Local statuses must be categorized *after* their hashtags exist.
  # PostStatusService commits the status row first and only attaches hashtags
  # afterwards, in postprocess_status! (ProcessHashtagsService) -- so the
  # model-level after_commit fires too early: the categorization worker would
  # read an empty tags association and file the status as unclassified.
  # Remote statuses keep the model callback (see
  # Epsilon::Categorization::StatusExtension): their tags are attached inside
  # the creation transaction.
  def postprocess_status!
    super

    Epsilon::Categorization::CategorizeStatusWorker.perform_async(@status.id)
  end
end
