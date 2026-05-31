defmodule YjsCollabWeb.Router do
  use YjsCollabWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/api", YjsCollabWeb do
    pipe_through :api

    get "/health", HealthController, :index
    get "/docs/:id/updates", DocumentController, :get_updates
    post "/docs/:id/updates", DocumentController, :create_update

    get "/docs/:id/versions", DocumentController, :get_version_history
    get "/docs/:id/versions/:version", DocumentController, :get_version_content
    post "/docs/:id/rollback", DocumentController, :rollback
    get "/docs/:id/rollback/timestamp", DocumentController, :rollback_by_timestamp
  end
end
