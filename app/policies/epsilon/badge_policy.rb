# frozen_string_literal: true

class Epsilon::BadgePolicy < ApplicationPolicy
  def index?
    role.can?(:manage_users)
  end

  def show?
    index?
  end

  def create?
    index?
  end

  def update?
    index?
  end

  def destroy?
    index?
  end
end
