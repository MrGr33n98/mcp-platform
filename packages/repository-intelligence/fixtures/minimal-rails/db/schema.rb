ActiveRecord::Schema[8.0].define(version: 2026_01_01_000000) do
  enable_extension "pgcrypto"
  enable_extension "postgis"

  create_table "organizations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "slug", null: false
    t.datetime "created_at", null: false
    t.index ["slug"], name: "index_organizations_on_slug", unique: true
  end

  create_table "missions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "organization_id", null: false
    t.string "title", null: false
    t.string "status", default: "draft", null: false
    t.datetime "created_at", null: false
    t.index ["organization_id"], name: "index_missions_on_organization_id"
  end
end
