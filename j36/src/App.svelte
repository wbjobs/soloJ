<script lang="ts">
  import { appStore, currentView } from './stores/appStore';
  import Sidebar from './components/Sidebar.svelte';
  import LibraryView from './views/LibraryView.svelte';
  import ReaderView from './views/ReaderView.svelte';
  import BatchView from './views/BatchView.svelte';
  import SearchView from './views/SearchView.svelte';
  import SettingsView from './views/SettingsView.svelte';
  import OcrView from './views/OcrView.svelte';
  import DiffView from './views/DiffView.svelte';
</script>

<svelte:head>
  <title>Ebook DRM Styler</title>
</svelte:head>

<div class="app-container">
  <Sidebar />
  
  <main class="main-content">
    {#if $currentView === 'library'}
      <LibraryView />
    {:else if $currentView === 'reader'}
      <ReaderView />
    {:else if $currentView === 'batch'}
      <BatchView />
    {:else if $currentView === 'search'}
      <SearchView />
    {:else if $currentView === 'settings'}
      <SettingsView />
    {:else if $currentView === 'ocr'}
      <OcrView />
    {:else if $currentView === 'diff'}
      <DiffView />
    {/if}
  </main>
  
  {#if $appStore.error}
    <div class="error-toast">
      <span>{$appStore.error}</span>
      <button on:click={() => $appStore.setError(null)}>✕</button>
    </div>
  {/if}
  
  {#if $appStore.isProcessing}
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>处理中，请稍候...</p>
    </div>
  {/if}
</div>

<style>
  .app-container {
    display: flex;
    height: 100vh;
    overflow: hidden;
    background: #f8f9fa;
  }
  
  .main-content {
    flex: 1;
    overflow: auto;
    position: relative;
  }
  
  .error-toast {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  }
  
  .error-toast button {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 16px;
    padding: 0 4px;
  }
  
  .loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    color: white;
  }
  
  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .loading-overlay p {
    margin-top: 16px;
    font-size: 16px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
