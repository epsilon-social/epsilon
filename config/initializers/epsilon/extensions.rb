# frozen_string_literal: true

Rails.application.config.to_prepare do
  Status.include(Epsilon::StatusExtension) if defined?(Status)

  PostStatusService.prepend(Epsilon::AiModerationPostStatusExtension) if defined?(PostStatusService)
  PostStatusService.prepend(Epsilon::Categorization::PostStatusExtension) if defined?(PostStatusService)
  UpdateStatusService.prepend(Epsilon::AiModerationUpdateStatusExtension) if defined?(UpdateStatusService)

  REST::StatusSerializer.include(Epsilon::StatusSerializerExtension) if defined?(REST::StatusSerializer)
  REST::AccountSerializer.include(Epsilon::AccountSerializerExtension) if defined?(REST::AccountSerializer)

  User.include(Epsilon::UserBadgeExtension) if defined?(User)

  Account.include(Epsilon::UsernameNormalizationExtension) if defined?(Account)

  DateOfBirthInput.prepend(Epsilon::DateOfBirthInputExtension) if defined?(DateOfBirthInput)

  if defined?(AccountSearchService)
    AccountSearchService::QueryBuilder.prepend(Epsilon::AccountSearchRankingExtension::QueryBuilder)
    AccountSearchService::FullQueryBuilder.prepend(Epsilon::AccountSearchRankingExtension::FullQueryBuilder)
  end

  NotifyService.prepend(Epsilon::NotifyServiceExtension) if defined?(NotifyService)
  FanOutOnWriteService.prepend(Epsilon::FanOutOnWriteServiceExtension) if defined?(FanOutOnWriteService)
  FollowService.prepend(Epsilon::Categorization::FollowServiceExtension) if defined?(FollowService)
  PrecomputeFeedService.prepend(Epsilon::Categorization::PrecomputeFeedServiceExtension) if defined?(PrecomputeFeedService)
  UnmergeWorker.prepend(Epsilon::Categorization::UnmergeWorkerExtension) if defined?(UnmergeWorker)
  ActivityPub::DistributionWorker.prepend(Epsilon::ActivityPubDistributionWorkerExtension) if defined?(ActivityPub::DistributionWorker)
end
