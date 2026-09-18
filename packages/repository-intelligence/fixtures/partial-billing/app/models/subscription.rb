class Subscription < ApplicationRecord
  belongs_to :organization
  enum :status, { active: "active", canceled: "canceled" }
end
