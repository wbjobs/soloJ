<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import * as Y from 'yjs';
  import { diffLines } from 'diff';

  export let isOpen: boolean;
  export let docId: string;
  export let version: number | null = null;
  export let currentContent: string = '';

  const dispatch = createEventDispatcher();

  let historicalContent: string = '';
  let loading = false;
  let error: string | null = null;
  let diffChanges: Change[] = [];
  let rollingBack = false;

  $: if (isOpen && docId && version !== null) {
    loadHistoricalVersion();
  }

  async function loadHistoricalVersion() {
    if (!docId || version === null) return;

    loading = true;
    error = null;
    historicalContent = '';
    diffChanges = [];

    try {
      const response = await fetch(`http://localhost:4000/api/docs/${docId}/versions/${version}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();

      const tempDoc = new Y.Doc();
      const updateBinary = base64ToUint8Array(data.update_base64);
      Y.applyUpdate(tempDoc, updateBinary);

      const ytext = tempDoc.getText('codemirror');
      historicalContent = ytext.toString();

      computeDiff();
    } catch (e) {
      error = (e as Error).message;
      console.error('[VersionDiff] Failed to load historical version:', e);
    } finally {
      loading = false;
    }
  }

  function computeDiff() {
    const diff = diffLines(currentContent, historicalContent);
    diffChanges = diff;
  }

  async function rollback() {
    if (!docId || version === null || rollingBack) return;

    if (!confirm(`确定要回滚到版本 v${version} 吗？这将覆盖当前所有内容！`)) {
      return;
    }

    rollingBack = true;

    try {
      const formData = new URLSearchParams();
      formData.append('version', String(version));

      const response = await fetch(`http://localhost:4000/api/docs/${docId}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      dispatch('rolledback', { version });
      close();
    } catch (e) {
      error = (e as Error).message;
      console.error('[VersionDiff] Failed to rollback:', e);
    } finally {
      rollingBack = false;
    }
  }

  function close() {
    dispatch('close');
  }

  function base64ToUint8Array(base64: string): Uint8Array {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  }

  function getLineClass(change: Change): string {
    if (change.added) return 'added';
    if (change.removed) return 'removed';
    return 'unchanged';
  }

  let addCount = 0;
  let removeCount = 0;

  $: {
    addCount = 0;
    removeCount = 0;
    for (const change of diffChanges) {
      if (change.added) {
        addCount += change.count || 0;
      } else if (change.removed) {
        removeCount += change.count || 0;
      }
    }
  }
</script>

{#if isOpen}
  <div class="modal-overlay" on:click|self={close}>
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">
          📋 版本对比
          {#if version !== null}
            <span class="version-badge">v{version}</span>
          {/if}
        </h3>
        <button class="close-btn" on:click={close}>✕</button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="loading">加载历史版本中...</div>
        {:else if error}
          <div class="error">
            错误: {error}
            <button class="retry-btn" on:click={loadHistoricalVersion}>重试</button>
          </div>
        {:else}
          <div class="diff-stats">
            <span class="stat added">+ {addCount} 行新增</span>
            <span class="stat removed">- {removeCount} 行删除</span>
          </div>

          <div class="diff-container">
            <div class="diff-content">
              {#each diffChanges as change}
                {#each change.value.split('\n').slice(0, -1) as line}
                  <div class="diff-line {getLineClass(change)}">
                    <span class="line-marker">
                      {change.added ? '+' : change.removed ? '-' : ' '}
                    </span>
                    <span class="line-text">{line || ' '}</span>
                  </div>
                {/each}
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={close}>
          关闭
        </button>
        <button
          class="btn btn-danger"
          on:click={rollback}
          disabled={loading || rollingBack || version === null}
        >
          {rollingBack ? '回滚中...' : '回滚到此版本'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style scoped>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal {
    width: 90%;
    max-width: 1000px;
    max-height: 85vh;
    background-color: #252526;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #3e3e42;
    flex-shrink: 0;
  }

  .modal-title {
    margin: 0;
    font-size: 18px;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .version-badge {
    font-size: 14px;
    font-weight: normal;
    background-color: #0e639c;
    padding: 2px 10px;
    border-radius: 12px;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #3e3e42;
    border: none;
    border-radius: 4px;
    color: #d4d4d4;
    cursor: pointer;
    font-size: 16px;
    transition: background-color 0.2s;
  }

  .close-btn:hover {
    background-color: #4e4e52;
  }

  .modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 16px 20px;
  }

  .loading {
    padding: 40px;
    text-align: center;
    color: #888;
  }

  .error {
    padding: 40px;
    text-align: center;
    color: #f48771;
  }

  .retry-btn {
    margin-top: 12px;
    padding: 8px 20px;
    background-color: #0e639c;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
  }

  .diff-stats {
    display: flex;
    gap: 20px;
    padding: 12px 16px;
    background-color: #2d2d30;
    border-radius: 4px;
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .stat {
    font-size: 14px;
    font-weight: 500;
  }

  .stat.added {
    color: #89ca78;
  }

  .stat.removed {
    color: #f48771;
  }

  .diff-container {
    flex: 1;
    overflow: auto;
    background-color: #1e1e1e;
    border-radius: 4px;
  }

  .diff-content {
    padding: 8px 0;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.5;
  }

  .diff-line {
    display: flex;
    padding: 0 12px;
  }

  .diff-line:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .diff-line.added {
    background-color: rgba(137, 202, 120, 0.15);
  }

  .diff-line.removed {
    background-color: rgba(244, 135, 113, 0.15);
  }

  .line-marker {
    display: inline-block;
    width: 20px;
    flex-shrink: 0;
    text-align: center;
    color: #888;
    user-select: none;
  }

  .diff-line.added .line-marker {
    color: #89ca78;
  }

  .diff-line.removed .line-marker {
    color: #f48771;
  }

  .line-text {
    flex: 1;
    white-space: pre;
    color: #d4d4d4;
  }

  .diff-line.added .line-text {
    color: #89ca78;
  }

  .diff-line.removed .line-text {
    color: #f48771;
    text-decoration: line-through;
    opacity: 0.8;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid #3e3e42;
    flex-shrink: 0;
  }

  .btn {
    padding: 10px 24px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #3e3e42;
    color: #d4d4d4;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: #4e4e52;
  }

  .btn-danger {
    background-color: #c93c37;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #e04b46;
  }
</style>
