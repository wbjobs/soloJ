defmodule YjsCollab.Repo do
  use Ecto.Repo,
    otp_app: :yjs_collab,
    adapter: Ecto.Adapters.Postgres
end
