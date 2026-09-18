class ProcessMissionJob < ApplicationJob
  queue_as :critical

  def perform(mission_id)
    # Processing
  end
end
