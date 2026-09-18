class Project < ApplicationRecord
  # Falha intencional de tenancy: sem belongs_to :organization
  has_many :tasks
end
