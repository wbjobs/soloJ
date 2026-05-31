defmodule YjsCollabWeb do
  def controller do
    quote do
      use Phoenix.Controller,
        formats: [:json],
        layout: false,
        get_format: "application/json"

      import Plug.Conn
    end
  end

  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  def router do
    quote do
      use Phoenix.Router

      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
