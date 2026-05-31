defmodule YjsCollab.Repo.Migrations.CreateYjsDocSnapshots do
  use Ecto.Migration

  def change do
    create table(:yjs_doc_snapshots, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :doc_id, :string, null: false
      add :snapshot, :binary, null: false
      add :version, :integer, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:yjs_doc_snapshots, [:doc_id])
  end
end
