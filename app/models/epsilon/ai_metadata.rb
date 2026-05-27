# frozen_string_literal: true

# == Schema Information
#
# Table name: epsilon_ai_metadata
#
#  id              :bigint(8)        not null, primary key
#  categories_raw  :jsonb            not null
#  mistral_payload :jsonb            not null
#  violence_score  :float            default(0.0), not null
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#  status_id       :bigint(8)        not null
#
module Epsilon
  class AiMetadata < ApplicationRecord
    self.table_name = 'epsilon_ai_metadata'

    belongs_to :status, class_name: '::Status', inverse_of: :epsilon_ai_metadata
  end
end
