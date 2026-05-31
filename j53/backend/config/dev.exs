import Config

config :yjs_collab, YjsCollab.Repo,
  database: "yjs_collab_dev",
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  port: 5432,
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10

config :yjs_collab, YjsCollabWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 4000],
  check_origin: false,
  code_reloader: false,
  debug_errors: true,
  secret_key_base: "dev_secret_key_base_yjs_collab_please_change_this_value_in_production_1234567890",
  watchers: []

config :logger, :console, format: "[$level] $message\n"

config :phoenix, :stacktrace_depth, 20
config :phoenix, :plug_init_mode, :runtime
