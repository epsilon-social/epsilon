# frozen_string_literal: true

Chewy.strategy(:mastodon) do
  Rails.root.glob('db/seeds/*.rb').each do |seed|
    load seed
  end

  unless Rails.env.test?
    Rails.logger.info 'EPSILON: Initialization of system account...'
    require 'rake'
    Rails.application.load_tasks if Rake::Task.tasks.empty?
    Rake::Task['epsilon:setup_sentinel'].invoke
  end
end
