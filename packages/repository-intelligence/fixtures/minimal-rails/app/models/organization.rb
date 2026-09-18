class Organization < ApplicationRecord
  has_many :missions, dependent: :destroy
end
