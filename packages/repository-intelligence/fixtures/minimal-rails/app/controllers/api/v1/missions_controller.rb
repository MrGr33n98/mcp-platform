class Api::V1::MissionsController < ApplicationController
  def index
    @missions = current_organization.missions
    render json: @missions
  end

  def show
    @mission = current_organization.missions.find(params[:id])
    authorize @mission
    render json: @mission
  end

  def create
    @mission = current_organization.missions.build(mission_params)
    authorize @mission
    if @mission.save
      render json: @mission, status: :created
    else
      render json: { errors: @mission.errors }, status: :unprocessable_entity
    end
  end

  private

  def mission_params
    params.require(:mission).permit(:title)
  end
end
