ActiveAdmin.register Organization do
  permit_params :name, :slug

  index do
    selectable_column
    id_column
    column :name
    column :slug
    column :created_at
    actions
  end
end
