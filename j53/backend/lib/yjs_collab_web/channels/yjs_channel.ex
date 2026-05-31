defmodule YjsCollabWeb.YjsChannel do
  @moduledoc """
  Yjs WebSocket Channel

  处理 Yjs 同步协议的 Phoenix Channel

  消息类型（Yjs 标准协议）：
  - 0: sync_step1  - 客户端发送状态向量
  - 1: sync_step2  - 服务器返回差异更新
  - 2: update      - 增量更新
  - 3: awareness   - 光标/选区等感知信息

  关键修复：
  1. 使用 base64 编码传输二进制数据（Phoenix 要求 JSON 可序列化）
  2. 正确实现 Yjs 同步握手协议
  3. 广播 awareness 给所有客户端（除了发送者）
  4. 订阅 PubSub 接收其他进程的更新
  5. 正确处理连接和断开清理
  """

  use YjsCollabWeb, :channel

  @sync_step1 0
  @sync_step2 1
  @update 2
  @message_yjs_awareness 3

  @impl true
  def join("yjs:" <> doc_id, _payload, socket) do
    send(self(), {:after_join, doc_id})

    YjsCollab.Yjs.subscribe(doc_id)

    socket =
      socket
      |> assign(:doc_id, doc_id)
      |> assign(:client_id, generate_client_id(socket))

    {:ok, %{doc_id: doc_id, client_id: socket.assigns.client_id}, socket}
  end

  @impl true
  def handle_info({:after_join, doc_id}, socket) do
    case YjsCollab.Yjs.handle_sync_step1(doc_id, <<>>) do
      {:ok, sync_step2_response} ->
        push(socket, "sync_step2", %{
          data: Base.encode64(sync_step2_response)
        })

      _ ->
        push(socket, "sync_step2", %{data: Base.encode64(<<@sync_step2>>)})
    end

    {:noreply, socket}
  end

  @impl true
  def handle_info({:update, binary_data, _version, source_client_id}, socket) do
    if source_client_id != socket.assigns.client_id do
      push(socket, "update", %{data: Base.encode64(binary_data)})
    end

    {:noreply, socket}
  end

  @impl true
  def handle_info({:awareness, binary_data, source_client_id}, socket) do
    if source_client_id != socket.assigns.client_id do
      push(socket, "awareness", %{data: Base.encode64(binary_data)})
    end

    {:noreply, socket}
  end

  @impl true
  def handle_info(_msg, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_in("sync_step1", %{"data" => data_base64}, socket) do
    doc_id = socket.assigns.doc_id

    case Base.decode64(data_base64) do
      {:ok, data} ->
        <<_type::8, state_vector::binary>> = data

        case YjsCollab.Yjs.handle_sync_step1(doc_id, state_vector) do
          {:ok, response} ->
            push(socket, "sync_step2", %{data: Base.encode64(response)})

          _ ->
            push(socket, "sync_step2", %{data: Base.encode64(<<@sync_step2>>)})
        end

      _ ->
        push(socket, "error", %{reason: "invalid base64"})
    end

    {:noreply, socket}
  end

  @impl true
  def handle_in("sync_step2", %{"data" => data_base64}, socket) do
    doc_id = socket.assigns.doc_id
    client_id = socket.assigns.client_id

    case Base.decode64(data_base64) do
      {:ok, <<_type::8, update_binary::binary>>} ->
        YjsCollab.Yjs.handle_update(doc_id, update_binary, client_id)

      _ ->
        :ok
    end

    {:noreply, socket}
  end

  @impl true
  def handle_in("update", %{"data" => data_base64}, socket) do
    doc_id = socket.assigns.doc_id
    client_id = socket.assigns.client_id

    case Base.decode64(data_base64) do
      {:ok, data} ->
        <<_type::8, update_binary::binary>> = data
        YjsCollab.Yjs.handle_update(doc_id, update_binary, client_id)

      _ ->
        push(socket, "error", %{reason: "invalid base64"})
    end

    {:noreply, socket}
  end

  @impl true
  def handle_in("awareness", %{"data" => data_base64}, socket) do
    doc_id = socket.assigns.doc_id
    client_id = socket.assigns.client_id

    case Base.decode64(data_base64) do
      {:ok, data} ->
        <<_type::8, awareness_binary::binary>> = data
        YjsCollab.Yjs.handle_awareness(doc_id, awareness_binary, client_id)

      _ ->
        :ok
    end

    {:noreply, socket}
  end

  @impl true
  def handle_in("binary_msg", %{"data" => data_base64}, socket) do
    case Base.decode64(data_base64) do
      {:ok, data} ->
        handle_binary_message(data, socket)

      _ ->
        push(socket, "error", %{reason: "invalid base64"})
        {:noreply, socket}
    end
  end

  @impl true
  def handle_in(_event, _payload, socket) do
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    doc_id = socket.assigns[:doc_id]
    if doc_id do
      YjsCollab.Yjs.unsubscribe(doc_id)
    end

    :ok
  end

  ## Private Functions

  defp handle_binary_message(<<@sync_step1, state_vector::binary>>, socket) do
    doc_id = socket.assigns.doc_id

    case YjsCollab.Yjs.handle_sync_step1(doc_id, state_vector) do
      {:ok, response} ->
        push(socket, "binary_msg", %{data: Base.encode64(response)})

      _ ->
        push(socket, "binary_msg", %{data: Base.encode64(<<@sync_step2>>)})
    end

    {:noreply, socket}
  end

  defp handle_binary_message(<<@sync_step2, update_binary::binary>>, socket) do
    doc_id = socket.assigns.doc_id
    client_id = socket.assigns.client_id

    YjsCollab.Yjs.handle_update(doc_id, update_binary, client_id)

    {:noreply, socket}
  end

  defp handle_binary_message(<<@update, update_binary::binary>>, socket) do
    doc_id = socket.assigns.doc_id
    client_id = socket.assigns.client_id

    YjsCollab.Yjs.handle_update(doc_id, update_binary, client_id)

    {:noreply, socket}
  end

  defp handle_binary_message(<<@message_yjs_awareness, awareness_binary::binary>>, socket) do
    doc_id = socket.assigns.doc_id
    client_id = socket.assigns.client_id

    YjsCollab.Yjs.handle_awareness(doc_id, awareness_binary, client_id)

    {:noreply, socket}
  end

  defp handle_binary_message(_, socket) do
    {:noreply, socket}
  end

  defp generate_client_id(socket) do
    base =
      case socket.assigns[:client_id] do
        nil -> :erlang.phash2(socket.transport_pid)
        id -> id
      end

    "elixir-#{base}-#{System.system_time(:millisecond)}"
  end
end
