class User < ApplicationRecord
  belongs_to :organization
  has_many :missions
end
