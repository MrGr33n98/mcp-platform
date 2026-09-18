class MissionPolicy < ApplicationPolicy
  def index?
    true
  end

  def show?
    record.organization_id == user.organization_id
  end

  def create?
    user.admin?
  end
end
