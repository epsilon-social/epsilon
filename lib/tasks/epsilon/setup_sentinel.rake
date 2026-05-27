# frozen_string_literal: true

namespace :epsilon do
  desc 'Initialize the Epsilon AI system account (Sentinel)'
  task setup_sentinel: :environment do
    username = 'EpsilonSafety'
    domain = Rails.configuration.x.local_domain || 'localhost'
    email = "#{username.downcase}@#{domain}"

    account = Account.find_or_initialize_by(username: username, domain: nil)

    if account.persisted?
      puts "EPSILON: The #{username} bot already exists."
      next
    end

    ApplicationRecord.transaction do
      account.assign_attributes(
        display_name: 'Epsilon Safety',
        note: 'Automated moderation and instance assistance system.',
        locked: false,
        bot: true,
        actor_type: 'Application'
      )
      account.save!(validate: false)

      user = User.find_or_initialize_by(email: email)
      if user.new_record?
        user.assign_attributes(
          password: SecureRandom.hex(16),
          account: account,
          agreement: true,
          confirmed_at: Time.now.utc,
          approved: true,
          date_of_birth: '1990-01-01'
        )
        user.save!(validate: false)
      end

      role = UserRole.find_by(name: 'Moderator') || UserRole.find_by(name: 'Admin')

      if role
        user.update!(role: role)
        puts "EPSILON: The #{username} bot was successfully created with the #{role.name} role."
      else
        puts "EPSILON: Warning - The #{username} bot was created, but no role (Moderator/Admin) was found."
      end
    end
  end
end
