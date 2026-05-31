defmodule YjsCollabWeb.DocumentController do
  use YjsCollabWeb, :controller

  def get_updates(conn, %{"id" => doc_id}) do
    updates = YjsCollab.Yjs.get_all_updates(doc_id)
    version = YjsCollab.Yjs.get_latest_version(doc_id)

    json(conn, %{
      doc_id: doc_id,
      version: version,
      update_count: length(updates)
    })
  end

  def create_update(conn, %{"id" => doc_id, "update" => update_base64}) do
    update_binary = Base.decode64!(update_base64)

    case YjsCollab.Yjs.append_update(doc_id, update_binary) do
      {:ok, update_record} ->
        json(conn, %{
          status: "ok",
          version: update_record.version,
          id: update_record.id
        })

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: changeset.errors})
    end
  end

  def get_version_history(conn, %{"id" => doc_id}) do
    limit = Map.get(conn.query_params, "limit", "100") |> String.to_integer()

    versions = YjsCollab.Yjs.get_version_history(doc_id, limit)

    json(conn, %{
      doc_id: doc_id,
      versions: Enum.map(versions, fn v ->
        %{
          version: v.version,
          inserted_at: DateTime.to_iso8601(v.inserted_at),
          client_id: v.client_id
        }
      end)
    })
  end

  def get_version_content(conn, %{"id" => doc_id, "version" => version_str}) do
    with {version, _} <- Integer.parse(version_str),
         {:ok, update_binary} <- YjsCollab.Yjs.get_document_at_version(doc_id, version) do
      json(conn, %{
        doc_id: doc_id,
        version: version,
        update_base64: Base.encode64(update_binary)
      })
    else
      :error ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Invalid version number"})

      {:error, reason} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: to_string(reason)})
    end
  end

  def rollback(conn, %{"id" => doc_id} = params) do
    case params do
      %{"version" => version_str} ->
        with {version, _} <- Integer.parse(version_str),
             {:ok, result} <- YjsCollab.Yjs.rollback_to_version(doc_id, version) do
          json(conn, %{
            status: "ok",
            doc_id: doc_id,
            rolled_back_to: result.rolled_back_to,
            previous_version: result.previous_version
          })
        else
          :error ->
            conn
            |> put_status(:bad_request)
            |> json(%{error: "Invalid version number"})

          {:error, reason} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: to_string(reason)})
        end

      _ ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Missing version parameter"})
    end
  end

  def rollback_by_timestamp(conn, %{"id" => doc_id} = params) do
    case Map.get(params, "timestamp") do
      nil ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Missing timestamp parameter"})

      timestamp ->
        case YjsCollab.Yjs.rollback_to_timestamp(doc_id, timestamp) do
          {:ok, result} ->
            json(conn, %{
              status: "ok",
              doc_id: doc_id,
              rolled_back_to: result.rolled_back_to,
              previous_version: result.previous_version,
              timestamp: timestamp
            })

          {:error, reason} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: to_string(reason)})
        end
    end
  end
end
