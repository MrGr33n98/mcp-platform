module Missions
  class CreateService
    def self.call(params:, user:, organization:)
      organization.missions.create!(params.merge(user: user))
    end
  end
end
