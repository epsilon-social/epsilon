# frozen_string_literal: true

class EpsilonAccountReviewPolicy < ApplicationPolicy
  def index?
    role.can?(:manage_users)
  end

  def update?
    role.can?(:manage_users)
  end
end
