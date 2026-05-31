<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let docId: string;
  export let isOpen: boolean;
  export let selectedVersion: number | null = null;

  interface Version {
    version: number;
    inserted_at: string;
    client_id: string | null;
  }

  const dispatch = createEventDispatcher();

  let versions: Version[] = [];
  let loading = false;
  let error: string | null = null;

  async function loadVersions() {
    if (!docId) return;

    loading = true;
    error = null;

    try {
      const response = await fetch(`http://localhost:4000/api/docs/${docId}/versions?limit=50`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      versions = data.versions || [];
    } catch (e) {
      error = (e as Error).message;
      console.error('[VersionHistory] Failed to load versions:', e);
    } finally {
      loading = false;
    }
  }

  function selectVersion(version: Version) {
    selectedVersion = version.version;
    dispatch('select', version);
  }

  function closeSidebar() {
    dispatch('close');
  }

  function refresh() {
    loadVersions();
  }

  $: if (isOpen && docId) {
    loadVersions();
  }

  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function formatClientId(clientId: string | null): string {
    if (!clientId) return 'Unknown';
    if (clientId.startsWith('elixir-')) {
      return 'Server';
    }
    if (clientId.startsWith('user-')) {
      return clientId.substring(5, 13).toUpperCase();
    }
    return clientId.substring(0, 8).toUpperCase();
  }
</script>

<div class="sidebar {isOpen ? 'open' : ''}">
  <div class="sidebar-header">
    <h3 class="sidebar-title">📜 历史版本</h3>
    <div class="sidebar-actions">
      <button class="refresh-btn" on:click={refresh} disabled={loading} title="刷新">
        🔄
      </button>
      <button class="close-btn" on:click={closeSidebar}>✕</button>
    </div>
  </div>

  <div class="sidebar-content">
    {#if loading}
      <div class="loading">加载中...</div>
    {:else if error}
      <div class="error">
        加载失败: {error}
        <button class="retry-btn" on:click={loadVersions}>重试</button>
      </div>
    {:else if versions.length === 0}
      <div class="empty">暂无历史版本</div>
    {:else}
      <div class="version-list">
        {#each versions as version}
          <div
            class="version-item {selectedVersion === version.version ? 'selected' : ''}"
            on:click={() => selectVersion(version)}
          >
            <div class="version-header">
              <span class="version-number">v{version.version}</span>
              <span class="version-client">{formatClientId(version.client_id)}</span>
            </div>
            <div class="version-time">{formatDate(version.inserted_at)}</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style scoped>
  .sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 320px;
    height: 100vh;
    background-color: #252526;
    border-left: 1px solid #3e3e42;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 1000;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #3e3e42;
    flex-shrink: 0;
  }

  .sidebar-title {
    margin: 0;
    font-size: 16px;
    color: #ffffff;
  }

  .sidebar-actions {
    display: flex;
    gap: 8px;
  }

  .refresh-btn,
  .close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #3e3e42;
    border: none;
    border-radius: 4px;
    color: #d4d4d4;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  .refresh-btn:hover,
  .close-btn:hover {
    background-color: #0e639c;
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
  }

  .loading,
  .empty {
    padding: 24px 16px;
    text-align: center;
    color: #888;
  }

  .error {
    padding: 24px 16px;
    text-align: center;
    color: #f48771;
  }

  .retry-btn {
    margin-top: 12px;
    padding: 6px 16px;
    background-color: #0e639c;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
  }

  .version-list {
    padding: 8px;
  }

  .version-item {
    padding: 12px;
    margin-bottom: 4px;
    background-color: #2d2d30;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .version-item:hover {
    background-color: #3e3e42;
  }

  .version-item.selected {
    background-color: #0e639c;
    outline: 2px solid #1177bb;
  }

  .version-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .version-number {
    font-weight: 600;
    color: #ffffff;
    font-size: 14px;
  }

  .version-client {
    font-size: 12px;
    color: #888;
    background-color: #3e3e42;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .version-item.selected .version-client {
    background-color: rgba(255, 255, 255, 0.2);
    color: #d4d4d4;
  }

  .version-time {
    font-size: 12px;
    color: #888;
  }

  .version-item.selected .version-time {
    color: #d4d4d4;
  }
</style>
