class ProjectsController < ApplicationController
  def index
    # Falha: acessa todos os projetos sem filtrar por tenant
    @projects = Project.all
    render json: @projects
  end
end
