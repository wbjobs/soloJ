defmodule YjsCollabWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :yjs_collab

  socket "/socket", YjsCollabWeb.UserSocket,
    websocket: true,
    longpoll: false

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Jason,
    length: 100_000_000

  plug Plug.MethodOverride
  plug Plug.Head

  plug CORSPlug

  plug YjsCollabWeb.Router
end
