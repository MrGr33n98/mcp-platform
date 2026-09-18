Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :missions, only: [:index, :create, :show]
      post 'orders/:id/cancel', to: 'orders#cancel'
    end
  end
end
