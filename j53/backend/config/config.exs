import Config

config :yjs_collab,
  ecto_repos: [YjsCollab.Repo]

config :yjs_collab, YjsCollab.Repo,
  database: "yjs_collab",
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  port: 5432

config :yjs_collab, YjsCollabWeb.Endpoint,
  url: [host: "localhost"],
  secret_key_base: "yjs_collab_secret_key_base_please_change_in_production_1234567890",
  render_errors: [
    formats: [json: YjsCollabWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: YjsCollab.PubSub,
  live_view: [signing_salt: "yjs_collab_signing_salt"]

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

config :cors_plug,
  origin: ["http://localhost:5173"],
  max_age: 86400,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  headers: ["Authorization", "Content-Type", "Accept", "Origin", "User-Agent"]

import_config "#{config_env()}.exs"
