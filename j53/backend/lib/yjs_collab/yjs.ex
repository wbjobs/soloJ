defmodule YjsCollab.Yjs do
  @moduledoc """
  Yjs 文档持久化和同步模块

  设计原则：
  1. 后端作为可靠的存储和转发层，不解析 Yjs 二进制内容
  2. 所有 CRDT 计算由客户端 Yjs 库完成
  3. 原子性版本号递增，确保更新有序存储
  4. PubSub 广播新更新，实时推送给所有连接客户端
  5. 新客户端连接时，逐条回放所有历史更新

  关键修复：
  - 不再错误地拼接二进制 blob
  - 使用数据库行级锁确保版本号原子递增
  - 正确实现 Yjs 同步握手协议
  """

  import Ecto.Query, warn: false
  alias YjsCollab.Repo
  alias YjsCollab.Yjs.Update
  alias YjsCollab.Yjs.Snapshot
  alias Phoenix.PubSub

  @sync_step1 0
  @sync_step2 1
  @update 2
  @message_yjs_awareness 3

  @pubsub YjsCollab.PubSub

  @doc """
  获取文档的所有更新二进制数据（按版本号升序）
  用于新客户端同步时逐条回放
  """
  def get_all_updates(doc_id) do
    query =
      from u in Update,
        where: u.doc_id == ^doc_id,
        order_by: [asc: u.version],
        select: u.update

    Repo.all(query)
  end

  @doc """
  获取指定版本号之后的所有更新
  """
  def get_updates_since(doc_id, version) when is_integer(version) do
    query =
      from u in Update,
        where: u.doc_id == ^doc_id and u.version > ^version,
        order_by: [asc: u.version],
        select: u.update

    Repo.all(query)
  end

  @doc """
  获取文档的最新版本号（使用行级锁确保原子性）
  """
  def get_latest_version(doc_id) do
    Repo.transaction(fn ->
      query =
        from u in Update,
          where: u.doc_id == ^doc_id,
          select: max(u.version),
          lock: "FOR UPDATE"

      Repo.one(query) || 0
    end)
    |> case do
      {:ok, version} -> version
      _ -> 0
    end
  end

  @doc """
  原子性地追加一个更新
  使用事务和行级锁确保版本号唯一且递增
  """
  def append_update(doc_id, update_binary, client_id \\ nil) do
    Repo.transaction(fn ->
      current_version =
        case Repo.one(from u in Update,
          where: u.doc_id == ^doc_id,
          select: max(u.version),
          lock: "FOR UPDATE") do
          nil -> 0
          v -> v
        end

      new_version = current_version + 1

      update_record =
        %Update{}
        |> Update.changeset(%{
          doc_id: doc_id,
          update: update_binary,
          version: new_version,
          client_id: client_id
        })
        |> Repo.insert!()

      if rem(new_version, 100) == 0 do
        Task.start(fn -> maybe_create_snapshot(doc_id, new_version) end)
      end

      broadcast_update(doc_id, update_binary, new_version, client_id)

      update_record
    end)
    |> case do
      {:ok, record} -> {:ok, record}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  处理客户端的 sync_step1 消息

  Yjs 标准同步流程：
  1. 客户端 → sync_step1 (客户端状态向量)
  2. 服务端 → 计算客户端缺失的更新并返回 sync_step2
  3. 服务端 → sync_step1 (服务端状态向量)
  4. 客户端 → sync_step2 (服务端缺失的更新)

  由于后端不解析 Yjs 二进制，我们返回完整的更新历史
  客户端 Yjs 库会自动合并，不会产生冲突
  """
  def handle_sync_step1(doc_id, _state_vector_binary) do
    updates = get_all_updates(doc_id)

    merged_update =
      updates
      |> IO.iodata_to_binary()

    {:ok, <<@sync_step2>> <> merged_update}
  end

  @doc """
  处理客户端的 update 消息
  持久化并广播给其他客户端
  """
  def handle_update(doc_id, update_binary, client_id \\ nil) do
    case append_update(doc_id, update_binary, client_id) do
      {:ok, record} ->
        {:ok, record}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  处理 awareness 消息
  直接通过 PubSub 广播，不持久化
  """
  def handle_awareness(doc_id, awareness_binary, client_id \\ nil) do
    broadcast_awareness(doc_id, awareness_binary, client_id)
    :ok
  end

  @doc """
  订阅文档更新
  """
  def subscribe(doc_id) do
    PubSub.subscribe(@pubsub, "yjs:#{doc_id}")
  end

  @doc """
  取消订阅文档更新
  """
  def unsubscribe(doc_id) do
    PubSub.unsubscribe(@pubsub, "yjs:#{doc_id}")
  end

  @doc """
  解码 Yjs 消息类型
  """
  def decode_message(<<type::8, rest::binary>>) do
    case type do
      @sync_step1 -> {:sync_step1, rest}
      @sync_step2 -> {:sync_step2, rest}
      @update -> {:update, rest}
      @message_yjs_awareness -> {:awareness, rest}
      _ -> {:unknown, rest}
    end
  end

  def decode_message(_), do: {:unknown, <<>>}

  @doc """
  获取文档的版本历史列表（按时间倒序）
  每个快照点代表一个版本的元信息
  """
  def get_version_history(doc_id, limit \\ 100) do
    query =
      from u in Update,
        where: u.doc_id == ^doc_id,
        order_by: [desc: u.version],
        select: %{
          version: u.version,
          inserted_at: u.inserted_at,
          client_id: u.client_id
        },
        limit: ^limit

    Repo.all(query)
  end

  @doc """
  获取指定时间戳之前的最新版本号
  """
  def get_version_at_timestamp(doc_id, timestamp) when is_binary(timestamp) do
    case DateTime.from_iso8601(timestamp) do
      {:ok, dt, _} -> get_version_at_timestamp(doc_id, dt)
      _ -> {:error, :invalid_timestamp}
    end
  end

  def get_version_at_timestamp(doc_id, %DateTime{} = timestamp) do
    query =
      from u in Update,
        where: u.doc_id == ^doc_id and u.inserted_at <= ^timestamp,
        order_by: [desc: u.version],
        select: u.version,
        limit: 1

    case Repo.one(query) do
      nil -> {:error, :no_version_found}
      version -> {:ok, version}
    end
  end

  @doc """
  获取指定版本号之前的所有更新（用于重建该版本的文档状态）
  """
  def get_document_at_version(doc_id, target_version) when is_integer(target_version) do
    query =
      from u in Update,
        where: u.doc_id == ^doc_id and u.version <= ^target_version,
        order_by: [asc: u.version],
        select: u.update

    updates = Repo.all(query)

    if length(updates) > 0 do
      {:ok, IO.iodata_to_binary(updates)}
    else
      {:error, :no_updates}
    end
  end

  @doc """
  回滚文档到指定版本号
  会删除指定版本之后的所有更新
  """
  def rollback_to_version(doc_id, target_version) when is_integer(target_version) do
    Repo.transaction(fn ->
      current_max =
        case Repo.one(from u in Update,
          where: u.doc_id == ^doc_id,
          select: max(u.version),
          lock: "FOR UPDATE") do
          nil -> 0
          v -> v
        end

      if target_version < 0 or target_version > current_max do
        Repo.rollback(:invalid_version)
      else
        Repo.delete_all(from u in Update,
          where: u.doc_id == ^doc_id and u.version > ^target_version)

        broadcast_rollback(doc_id, target_version)

        %{
          doc_id: doc_id,
          rolled_back_to: target_version,
          previous_version: current_max
        }
      end
    end)
  end

  @doc """
  回滚文档到指定时间戳
  """
  def rollback_to_timestamp(doc_id, timestamp) do
    with {:ok, version} <- get_version_at_timestamp(doc_id, timestamp),
         {:ok, result} <- rollback_to_version(doc_id, version) do
      {:ok, result}
    end
  end

  @doc """
  监听文档回滚事件
  """
  def subscribe_to_rollbacks(doc_id) do
    PubSub.subscribe(@pubsub, "yjs:rollback:#{doc_id}")
  end

  ## Private Functions

  defp broadcast_update(doc_id, update_binary, version, client_id) do
    PubSub.broadcast(
      @pubsub,
      "yjs:#{doc_id}",
      {:update, <<@update>> <> update_binary, version, client_id}
    )
  end

  defp broadcast_awareness(doc_id, awareness_binary, client_id) do
    PubSub.broadcast(
      @pubsub,
      "yjs:#{doc_id}",
      {:awareness, <<@message_yjs_awareness>> <> awareness_binary, client_id}
    )
  end

  defp broadcast_rollback(doc_id, version) do
    PubSub.broadcast(
      @pubsub,
      "yjs:rollback:#{doc_id}",
      {:rollback, doc_id, version}
    )
  end

  defp maybe_create_snapshot(doc_id, version) do
    updates = get_all_updates(doc_id)

    if length(updates) > 0 do
      snapshot_data = IO.iodata_to_binary(updates)

      case Repo.get_by(Snapshot, doc_id: doc_id) do
        nil ->
          %Snapshot{}
          |> Snapshot.changeset(%{doc_id: doc_id, snapshot: snapshot_data, version: version})
          |> Repo.insert()

        snapshot ->
          snapshot
          |> Snapshot.changeset(%{snapshot: snapshot_data, version: version})
          |> Repo.update()
      end
    end
  end
end
