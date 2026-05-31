defmodule YjsCollabWeb.HealthController do
  use YjsCollabWeb, :controller

  def index(conn, _params) do
    json(conn, %{status: "ok"})
  end
end
