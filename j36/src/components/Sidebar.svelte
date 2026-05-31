<script lang="ts">
  import { appStore, currentView } from '../stores/appStore';
  import { 
    BookOpen, 
    Library, 
    Layers, 
    Search, 
    Settings,
    FolderOpen,
    Scan,
    GitCompare
  } from 'lucide-svelte';
  import { open } from '@tauri-apps/api/dialog';
  
  const navItems = [
    { id: 'library', label: '书库', icon: Library },
    { id: 'reader', label: '阅读', icon: BookOpen },
    { id: 'ocr', label: '文字识别', icon: Scan },
    { id: 'diff', label: '版本对比', icon: GitCompare },
    { id: 'batch', label: '批处理', icon: Layers },
    { id: 'search', label: '搜索', icon: Search },
    { id: 'settings', label: '设置', icon: Settings },
  ];
  
  async function openFile() {
    try {
      const selected = await open({
        filters: [{
          name: '电子书',
          extensions: ['pdf', 'epub', 'azw3', 'mobi']
        }],
        multiple: false
      });
      
      if (selected && typeof selected === 'string') {
        $appStore.setProcessing(true);
        $appStore.setError(null);
        
        // 延迟导入避免循环依赖
        const { parseEbook } = await import('../utils/tauriApi');
        const book = await parseEbook(selected);
        $appStore.setSelectedBook(book);
        $appStore.setView('reader');
        $appStore.setProcessing(false);
      }
    } catch (err: any) {
      $appStore.setError(err.message || '打开文件失败');
      $appStore.setProcessing(false);
    }
  }
  
  async function openFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false
      });
      
      if (selected && typeof selected === 'string') {
        // 批处理视图会处理
        $appStore.setView('batch');
        // 可以传递路径给批处理视图
        localStorage.setItem('lastBatchDirectory', selected);
      }
    } catch (err: any) {
      $appStore.setError(err.message || '打开文件夹失败');
    }
  }

  function handleNavClick(viewId: string) {
    $appStore.setView(viewId as any);
  }
</script>

<aside class="sidebar">
  <div class="sidebar-header">
    <div class="logo">
      <BookOpen size={32} />
      <h1>Ebook Styler</h1>
    </div>
    <p class="subtitle">智能电子书处理工具</p>
  </div>
  
  <div class="quick-actions">
    <button class="action-btn primary" on:click={openFile}>
      <FolderOpen size={18} />
      打开文件
    </button>
    <button class="action-btn secondary" on:click={openFolder}>
      <Layers size={18} />
      批处理
    </button>
  </div>
  
  <nav class="nav-menu">
    {#each navItems as item}
      <button
        class="nav-item {$currentView === item.id ? 'active' : ''}"
        on:click={() => handleNavClick(item.id)}
      >
        <svelte:component this={item.icon} size={20} />
        <span>{item.label}</span>
      </button>
    {/each}
  </nav>
  
  <div class="sidebar-footer">
    <p class="version">v1.0.0</p>
    <p class="disclaimer">仅供合法备份使用</p>
  </div>
</aside>

<style>
  .sidebar {
    width: 240px;
    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
    color: #e2e8f0;
    display: flex;
    flex-direction: column;
    padding: 20px 0;
    flex-shrink: 0;
  }
  
  .sidebar-header {
    padding: 0 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #60a5fa;
  }
  
  .logo h1 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: white;
  }
  
  .subtitle {
    margin: 8px 0 0;
    font-size: 12px;
    color: #94a3b8;
  }
  
  .quick-actions {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .action-btn.primary {
    background: #3b82f6;
    color: white;
  }
  
  .action-btn.primary:hover {
    background: #2563eb;
  }
  
  .action-btn.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
  }
  
  .action-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .nav-menu {
    flex: 1;
    padding: 0 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: #94a3b8;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
    text-align: left;
  }
  
  .nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #e2e8f0;
  }
  
  .nav-item.active {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }
  
  .sidebar-footer {
    padding: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .version {
    margin: 0 0 4px;
    font-size: 11px;
    color: #64748b;
  }
  
  .disclaimer {
    margin: 0;
    font-size: 10px;
    color: #475569;
  }
</style>
