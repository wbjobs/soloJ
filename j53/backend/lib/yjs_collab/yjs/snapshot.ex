defmodule YjsCollab.Yjs.Snapshot do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "yjs_doc_snapshots" do
    field :doc_id, :string
    field :snapshot, :binary
    field :version, :integer

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(snapshot, attrs) do
    snapshot
    |> cast(attrs, [:doc_id, :snapshot, :version])
    |> validate_required([:doc_id, :snapshot, :version])
  end
end
