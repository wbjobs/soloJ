<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { YjsProvider, type YjsConnectionState } from '$lib/yjsProvider';
  import { createEditor, type EditorInstance } from '$lib/codemirror/editor';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import LanguageSelector from '$lib/components/LanguageSelector.svelte';
  import VersionHistorySidebar from '$lib/components/VersionHistorySidebar.svelte';
  import VersionDiffModal from '$lib/components/VersionDiffModal.svelte';

  let yjsProvider: YjsProvider | null = null;
  let editor: EditorInstance | null = null;
  let container: HTMLDivElement | null = null;
  let connectionState: YjsConnectionState = {
    isConnected: false,
    isOnline: true,
    isSynced: false
  };
  let currentLanguage = 'javascript';
  let docId = 'demo-document';
  let unsubscribeState: (() => void) | null = null;
  let hasSetInitialContent = false;

  let sidebarOpen = false;
  let diffModalOpen = false;
  let selectedVersion: number | null = null;

  const DEFAULT_CONTENT = `// 欢迎使用协同文本编辑器!
// 支持多人实时协作编辑
// 即使断网也可以继续编辑，网络恢复后自动同步

function hello() {
  console.log("Hello, Collaborative Editor!");
  return true;
}

// 试试在两个浏览器窗口中同时编辑这个文件
// 你会看到实时同步效果
`;

  async function initEditor() {
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('doc');
    if (idFromUrl) {
      docId = idFromUrl;
    }

    yjsProvider = new YjsProvider(docId, 'ws://localhost:4000/socket/websocket');

    unsubscribeState = yjsProvider.onStateChange((state) => {
      connectionState = state;

      if (state.isSynced && !hasSetInitialContent) {
        setInitialContentIfEmpty();
      }
    });

    await yjsProvider.connect();

    editor = createEditor({
      container: container,
      yjsProvider: yjsProvider,
      language: currentLanguage as any
    });

    setTimeout(() => {
      editor?.focus();
    }, 100);
  }

  function setInitialContentIfEmpty() {
    if (!yjsProvider || hasSetInitialContent) return;

    const ytext = yjsProvider.getText('codemirror');

    if (ytext.length === 0) {
      ytext.insert(0, DEFAULT_CONTENT);
    }

    hasSetInitialContent = true;
  }

  function changeLanguage(language: string) {
    if (!container || !yjsProvider) return;
    currentLanguage = language;

    if (editor) {
      editor.destroy();
      editor = null;
    }

    editor = createEditor({
      container: container,
      yjsProvider: yjsProvider,
      language: language as any
    });

    setTimeout(() => {
      editor?.focus();
    }, 100);
  }

  function forceSync() {
    yjsProvider?.forceSync();
  }

  function openSidebar() {
    sidebarOpen = true;
  }

  function closeSidebar() {
    sidebarOpen = false;
  }

  function selectVersion(event: CustomEvent) {
    selectedVersion = event.detail.version;
    diffModalOpen = true;
  }

  function closeDiffModal() {
    diffModalOpen = false;
  }

  async function handleRollback(event: CustomEvent) {
    console.log(`Rolled back to version v${event.detail.version}`);
    closeDiffModal();
    closeSidebar();
    selectedVersion = null;

    if (yjsProvider) {
      yjsProvider.forceSync();
    }
  }

  function getCurrentContent(): string {
    if (!yjsProvider) return '';
    const ytext = yjsProvider.getText('codemirror');
    return ytext.toString();
  }

  onMount(() => {
    initEditor();
  });

  onDestroy(() => {
    if (unsubscribeState) {
      unsubscribeState();
      unsubscribeState = null;
    }
    if (editor) {
      editor.destroy();
      editor = null;
    }
    if (yjsProvider) {
      yjsProvider.disconnect();
      yjsProvider = null;
    }
  });
</script>

<div class="editor-container">
  <header class="header">
    <div class="header-left">
      <h1 class="title">📝 协同文本编辑器</h1>
      <span class="doc-id">文档: {docId}</span>
    </div>
    <div class="header-right">
      <LanguageSelector current={currentLanguage} on:change={(e) => changeLanguage(e.detail)} />
      <button class="history-btn" on:click={openSidebar} title="查看历史版本">
        📜 历史版本
      </button>
      <button class="sync-btn" on:click={forceSync} title="强制同步">
        🔄 同步
      </button>
    </div>
  </header>

  <main class="editor-main">
    <div bind:this={container} class="editor-wrapper"></div>
  </main>

  <StatusBar {connectionState} {docId} />
</div>

<VersionHistorySidebar
  {docId}
  isOpen={sidebarOpen}
  selectedVersion={selectedVersion}
  on:close={closeSidebar}
  on:select={selectVersion}
/>

<VersionDiffModal
  isOpen={diffModalOpen}
  {docId}
  version={selectedVersion}
  currentContent={getCurrentContent()}
  on:close={closeDiffModal}
  on:rolledback={handleRollback}
/>

<style scoped>
  .editor-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background-color: #1e1e1e;
    color: #d4d4d4;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background-color: #252526;
    border-bottom: 1px solid #3e3e42;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .title {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
  }

  .doc-id {
    font-size: 13px;
    color: #888;
    background-color: #2d2d30;
    padding: 4px 10px;
    border-radius: 4px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .history-btn {
    padding: 8px 16px;
    background-color: #6c5ce7;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: background-color 0.2s;
  }

  .history-btn:hover {
    background-color: #5b4cdb;
  }

  .history-btn:active {
    background-color: #4a3bc4;
  }

  .sync-btn {
    padding: 8px 16px;
    background-color: #0e639c;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: background-color 0.2s;
  }

  .sync-btn:hover {
    background-color: #1177bb;
  }

  .sync-btn:active {
    background-color: #0a4c7a;
  }

  .editor-main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .editor-wrapper {
    flex: 1;
    overflow: hidden;
  }
</style>
