# frozen_string_literal: true

# Adds the `epsilon_badges` array to the REST account serializer.
#
# Badges are LOCAL-ONLY on purpose: this REST attribute is never part of the
# ActivityPub payload, so remote instances never receive it. `if: :local?` also
# means the key is simply absent for remote accounts (only local accounts ever
# carry badges).
module Epsilon::AccountSerializerExtension
  extend ActiveSupport::Concern

  included do
    attribute :epsilon_badges, if: :local?
  end

  # Iterates the join (`account_badges`) rather than the badges association so
  # each entry also carries its obtention date (`granted_at`). Filtered to active
  # badges and ordered by priority — in Ruby, since the join is preloaded
  # (`account_badges: :badge`), so no extra query.
  def epsilon_badges
    object.account_badges
      .select { |account_badge| account_badge.badge.is_active? }
      .sort_by { |account_badge| [account_badge.badge.position, account_badge.badge.id] }
      .map do |account_badge|
      badge = account_badge.badge
      {
        id: badge.id.to_s,
        slug: badge.slug,
        name: badge.display_name,
        description: badge.display_description,
        color: badge.color,
        icon: badge.icon,
        granted_at: account_badge.granted_at&.iso8601,
      }
    end
  end
end
