defmodule YjsCollab.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      YjsCollab.Repo,
      {Phoenix.PubSub, name: YjsCollab.PubSub},
      YjsCollabWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: YjsCollab.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    YjsCollabWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
