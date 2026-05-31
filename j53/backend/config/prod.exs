import Config

config :yjs_collab, YjsCollab.Repo,
  database: "yjs_collab_prod",
  pool_size: 10

config :yjs_collab, YjsCollabWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 4000],
  cache_static_manifest: "priv/static/cache_manifest.json"

config :logger, level: :info

import_config "runtime.exs"
