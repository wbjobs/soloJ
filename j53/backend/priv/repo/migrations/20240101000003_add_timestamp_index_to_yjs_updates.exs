defmodule YjsCollab.Repo.Migrations.AddTimestampIndexToYjsUpdates do
  use Ecto.Migration

  def change do
    create index(:yjs_updates, [:doc_id, :inserted_at])
    create index(:yjs_updates, [:inserted_at])
  end
end
