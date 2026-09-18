class MissionPolicy < ApplicationPolicy
  def index?
    user.present?
  end

  def show?
    user.organization_id == record.organization_id
  end

  def create?
    user.admin? || user.operator?
  end
end
