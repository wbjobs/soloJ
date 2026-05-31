<script lang="ts">
  import type { YjsConnectionState } from '../yjsProvider';

  export let connectionState: YjsConnectionState;
  export let docId: string;

  $: statusText = getStatusText(connectionState);
  $: statusColor = getStatusColor(connectionState);

  function getStatusText(state: YjsConnectionState): string {
    if (!state.isOnline) {
      return '离线';
    }
    if (state.isConnected && state.isSynced) {
      return '已连接 · 已同步';
    }
    if (state.isConnected && !state.isSynced) {
      return '已连接 · 同步中...';
    }
    if (!state.isConnected && state.isOnline) {
      return '连接中...';
    }
    return '已断开';
  }

  function getStatusColor(state: YjsConnectionState): string {
    if (!state.isOnline) {
      return '#f44747';
    }
    if (state.isConnected && state.isSynced) {
      return '#89d185';
    }
    if (state.isConnected && !state.isSynced) {
      return '#cca700';
    }
    return '#f44747';
  }
</script>

<footer class="status-bar">
  <div class="status-left">
    <span class="status-indicator" style="background-color: {statusColor}"></span>
    <span class="status-text">{statusText}</span>
    {#if !connectionState.isOnline}
      <span class="offline-hint">（编辑内容将在网络恢复后自动同步）</span>
    {/if}
  </div>
  <div class="status-right">
    <span class="doc-info">📄 {docId}</span>
    <span class="storage-info">💾 IndexedDB 本地存储</span>
  </div>
</footer>

<style scoped>
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 16px;
    background-color: #007acc;
    color: white;
    font-size: 12px;
    flex-shrink: 0;
  }

  .status-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    box-shadow: 0 0 4px currentColor;
  }

  .status-text {
    font-weight: 500;
  }

  .offline-hint {
    opacity: 0.8;
    font-style: italic;
  }

  .status-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .doc-info,
  .storage-info {
    opacity: 0.9;
  }
</style>
