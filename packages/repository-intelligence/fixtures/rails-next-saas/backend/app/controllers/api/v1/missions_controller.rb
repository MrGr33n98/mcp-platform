module Api
  module V1
    class MissionsController < ApplicationController
      def index
        authorize Mission
        @missions = current_organization.missions
        render json: @missions
      end

      def create
        authorize Mission
        @mission = Missions::CreateService.call(params: params, user: current_user, organization: current_organization)
        ProcessMissionJob.perform_later(@mission.id)
        render json: @mission, status: :created
      end
    end
  end
end
