# frozen_string_literal: true

class EpsilonAiModerationSettingPolicy < ApplicationPolicy
  def show?
    role.can?(:manage_reports)
  end

  def update?
    role.can?(:manage_reports)
  end
end
