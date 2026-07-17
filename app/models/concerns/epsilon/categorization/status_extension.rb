# frozen_string_literal: true

module Epsilon::Categorization::StatusExtension
  extend ActiveSupport::Concern

  included do
    has_many :local_post_categorizations, class_name: 'Epsilon::Categorization::LocalPostCategorization', dependent: :destroy
    has_many :category_votes, class_name: 'Epsilon::Categorization::CategoryVote', dependent: :destroy

    scope :with_category, lambda { |category_id|
      joins(:local_post_categorizations)
        .where(local_post_categorizations: { category_master_id: category_id, is_validated: true })
    }

    scope :without_category, lambda { |category_id|
      joins(sanitize_sql_array(['LEFT JOIN local_post_categorizations lpc ON statuses.id = lpc.status_id AND lpc.category_master_id = ? AND lpc.is_validated = TRUE', category_id])).where(lpc: { id: nil })
    }

    after_commit :enqueue_categorization, on: :create

    private

    def enqueue_categorization
      Epsilon::Categorization::CategorizeStatusWorker.perform_async(id)
    end
  end
end
