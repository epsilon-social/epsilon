# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_ai_moderation_settings
#
#  id                    :bigint(8)        not null, primary key
#  ban_sexual            :decimal(3, 2)    default(0.8), not null
#  ban_violence          :decimal(3, 2)    default(0.8), not null
#  ban_vulgarity         :decimal(3, 2)    default(0.8), not null
# rubocop:disable Layout/LineLength
#  custom_prompt         :text             default("You are the content analysis radar for the Epsilon social network.\nYour only role is to analyze the provided text (regardless of its language) and return strict severity scores in JSON format. You do not make banning decisions; you solely measure and classify."), not null
# rubocop:enable Layout/LineLength
#  review_threshold      :decimal(3, 2)    default(0.5), not null
#  sensitive_sexual      :decimal(3, 2)    default(0.25), not null
#  sensitive_violence    :decimal(3, 2)    default(0.25), not null
#  sensitive_vulgarity   :decimal(3, 2)    default(0.25), not null
#  use_native_moderation :boolean          default(FALSE), not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
module Epsilon
  class AiModerationSetting < ApplicationRecord
    self.table_name = 'epsilon_ai_moderation_settings'

    validates :ban_violence, :ban_vulgarity, :ban_sexual,
              :sensitive_violence, :sensitive_vulgarity, :sensitive_sexual,
              :review_threshold,
              presence: true,
              numericality: { greater_than_or_equal_to: 0.0, less_than_or_equal_to: 1.0 }

    validates :custom_prompt, presence: true

    def self.current
      first_or_create!
    end
  end
end
