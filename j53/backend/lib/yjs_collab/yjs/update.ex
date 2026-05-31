defmodule YjsCollab.Yjs.Update do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "yjs_updates" do
    field :doc_id, :string
    field :update, :binary
    field :version, :integer
    field :client_id, :string

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(update, attrs) do
    update
    |> cast(attrs, [:doc_id, :update, :version, :client_id])
    |> validate_required([:doc_id, :update, :version])
  end
end
