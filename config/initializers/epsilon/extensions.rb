# frozen_string_literal: true

Rails.application.config.to_prepare do
  Status.include(Epsilon::StatusExtension) if defined?(Status)

  PostStatusService.prepend(Epsilon::AiModerationPostStatusExtension) if defined?(PostStatusService)
  UpdateStatusService.prepend(Epsilon::AiModerationUpdateStatusExtension) if defined?(UpdateStatusService)

  REST::StatusSerializer.include(Epsilon::StatusSerializerExtension) if defined?(REST::StatusSerializer)
  REST::AccountSerializer.include(Epsilon::AccountSerializerExtension) if defined?(REST::AccountSerializer)

  User.include(Epsilon::UserBadgeExtension) if defined?(User)

  NotifyService.prepend(Epsilon::NotifyServiceExtension) if defined?(NotifyService)
  FanOutOnWriteService.prepend(Epsilon::FanOutOnWriteServiceExtension) if defined?(FanOutOnWriteService)
  ActivityPub::DistributionWorker.prepend(Epsilon::ActivityPubDistributionWorkerExtension) if defined?(ActivityPub::DistributionWorker)
end
