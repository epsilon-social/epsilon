# frozen_string_literal: true

Rails.application.config.to_prepare do
  Status.include(Epsilon::StatusExtension) if defined?(Status)

  PostStatusService.prepend(Epsilon::AiModerationPostStatusExtension) if defined?(PostStatusService)
  UpdateStatusService.prepend(Epsilon::AiModerationUpdateStatusExtension) if defined?(UpdateStatusService)

  REST::StatusSerializer.include(Epsilon::StatusSerializerExtension) if defined?(REST::StatusSerializer)

  NotifyService.prepend(Epsilon::NotifyServiceExtension) if defined?(NotifyService)
  FanOutOnWriteService.prepend(Epsilon::FanOutOnWriteServiceExtension) if defined?(FanOutOnWriteService)
  ActivityPub::DistributionWorker.prepend(Epsilon::ActivityPubDistributionWorkerExtension) if defined?(ActivityPub::DistributionWorker)
end
