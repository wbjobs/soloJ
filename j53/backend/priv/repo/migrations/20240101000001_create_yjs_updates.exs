defmodule YjsCollab.Repo.Migrations.CreateYjsUpdates do
  use Ecto.Migration

  def change do
    create table(:yjs_updates, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :doc_id, :string, null: false
      add :update, :binary, null: false
      add :version, :integer, null: false
      add :client_id, :string

      timestamps(type: :utc_datetime)
    end

    create index(:yjs_updates, [:doc_id])
    create index(:yjs_updates, [:doc_id, :version], unique: true)
  end
end
