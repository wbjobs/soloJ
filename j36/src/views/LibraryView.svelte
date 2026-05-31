<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from '../stores/appStore';
  import { parseEbook, scanDirectory, listIndexedBooks } from '../utils/tauriApi';
  import { formatFileSize, getFormatIcon, truncate } from '../utils/helpers';
  import type { ParsedBook, BookMetadata } from '../types';
  import { BookOpen, FileText, Clock } from 'lucide-svelte';
  import { open } from '@tauri-apps/api/dialog';
  
  let recentFiles: string[] = [];
  let indexedBooks: [string, BookMetadata][] = [];
  let isLoading = false;
  
  onMount(async () => {
    await loadIndexedBooks();
    const saved = localStorage.getItem('recentFiles');
    if (saved) {
      recentFiles = JSON.parse(saved);
    }
  });
  
  async function loadIndexedBooks() {
    try {
      indexedBooks = await listIndexedBooks();
    } catch (err) {
      console.error('Failed to load indexed books:', err);
    }
  }
  
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
        await openBook(selected);
      }
    } catch (err: any) {
      $appStore.setError(err.message || '打开文件失败');
    }
  }
  
  async function openFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false
      });
      
      if (selected && typeof selected === 'string') {
        isLoading = true;
        const files = await scanDirectory(selected, true);
        $appStore.setProcessing(false);
        
        if (files.length === 0) {
          $appStore.setError('该目录下没有找到支持的电子书文件');
        } else if (files.length === 1) {
          await openBook(files[0]);
        } else {
          localStorage.setItem('lastBatchDirectory', selected);
          $appStore.setView('batch');
        }
        isLoading = false;
      }
    } catch (err: any) {
      $appStore.setError(err.message || '打开文件夹失败');
      isLoading = false;
    }
  }
  
  async function openBook(path: string) {
    $appStore.setProcessing(true);
    $appStore.setError(null);
    
    try {
      const book = await parseEbook(path);
      $appStore.setSelectedBook(book);
      $appStore.setView('reader');
      
      recentFiles = [path, ...recentFiles.filter(f => f !== path)].slice(0, 10);
      localStorage.setItem('recentFiles', JSON.stringify(recentFiles));
    } catch (err: any) {
      $appStore.setError(err.message || '解析电子书失败');
    } finally {
      $appStore.setProcessing(false);
    }
  }
  
  async function openFromIndexed(bookId: string, metadata: BookMetadata) {
    // 需要先解析书籍
    // 这里简化处理，实际应该从索引中重建或重新解析
    console.log('Opening indexed book:', bookId, metadata.title);
  }
</script>

<div class="library-view">
  <header class="view-header">
    <h2>书库</h2>
    <div class="header-actions">
      <button class="btn secondary" on:click={openFolder}>
        <FileText size={18} />
        打开文件夹
      </button>
      <button class="btn primary" on:click={openFile}>
        <BookOpen size={18} />
        打开电子书
      </button>
    </div>
  </header>
  
  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>正在扫描目录...</p>
    </div>
  {:else}
    <section class="section">
      <h3 class="section-title">最近打开</h3>
      {#if recentFiles.length > 0}
        <div class="book-grid">
          {#each recentFiles as path}
            <div class="book-card" on:click={() => openBook(path)}>
              <div class="book-icon">📖</div>
              <div class="book-info">
                <h4>{truncate(path.split('\\').pop()?.split('/').pop() || path, 30)}</h4>
                <p class="book-path">{truncate(path, 40)}</p>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <BookOpen size={48} />
          <p>还没有打开过任何电子书</p>
          <p class="hint">点击上方按钮开始</p>
        </div>
      {/if}
    </section>
    
    {#if indexedBooks.length > 0}
      <section class="section">
        <h3 class="section-title">已索引书籍</h3>
        <div class="book-table">
          <table>
            <thead>
              <tr>
                <th>书名</th>
                <th>作者</th>
                <th>格式</th>
                <th>大小</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {#each indexedBooks as [id, metadata]}
                <tr on:click={() => openFromIndexed(id, metadata)}>
                  <td>
                    <span class="format-icon">{getFormatIcon(metadata.format)}</span>
                    {metadata.title || '未知标题'}
                  </td>
                  <td>{metadata.authors.join(', ') || '未知作者'}</td>
                  <td>{metadata.format}</td>
                  <td>{formatFileSize(metadata.fileSize)}</td>
                  <td>
                    <button class="btn-link" on:click|stopPropagation={() => openFromIndexed(id, metadata)}>
                      查看
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
    
    <section class="section">
      <h3 class="section-title">支持的格式</h3>
      <div class="format-cards">
        <div class="format-card">
          <div class="format-icon">📄</div>
          <h4>PDF</h4>
          <p>Adobe 便携文档格式</p>
        </div>
        <div class="format-card">
          <div class="format-icon">📖</div>
          <h4>EPUB</h4>
          <p>开放电子书标准</p>
        </div>
        <div class="format-card">
          <div class="format-icon">📱</div>
          <h4>AZW3</h4>
          <p>Amazon Kindle 格式</p>
        </div>
        <div class="format-card">
          <div class="format-icon">📱</div>
          <h4>MOBI</h4>
          <p>Mobipocket 格式</p>
        </div>
      </div>
    </section>
  {/if}
</div>

<style>
  .library-view {
    padding: 30px;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
  }
  
  .view-header h2 {
    margin: 0;
    font-size: 28px;
    color: #1e293b;
  }
  
  .header-actions {
    display: flex;
    gap: 12px;
  }
  
  .btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .btn.primary {
    background: #3b82f6;
    color: white;
  }
  
  .btn.primary:hover {
    background: #2563eb;
  }
  
  .btn.secondary {
    background: #e2e8f0;
    color: #1e293b;
  }
  
  .btn.secondary:hover {
    background: #cbd5e1;
  }
  
  .section {
    margin-bottom: 40px;
  }
  
  .section-title {
    font-size: 18px;
    font-weight: 600;
    color: #334155;
    margin: 0 0 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #e2e8f0;
  }
  
  .book-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  
  .book-card {
    display: flex;
    gap: 16px;
    padding: 20px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .book-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
    transform: translateY(-2px);
  }
  
  .book-icon {
    font-size: 40px;
    flex-shrink: 0;
  }
  
  .book-info {
    min-width: 0;
  }
  
  .book-info h4 {
    margin: 0 0 6px;
    font-size: 15px;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .book-path {
    margin: 0;
    font-size: 12px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .book-table {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th, td {
    padding: 14px 16px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }
  
  th {
    background: #f8fafc;
    font-weight: 600;
    font-size: 13px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  tbody tr {
    cursor: pointer;
    transition: background 0.15s;
  }
  
  tbody tr:hover {
    background: #f8fafc;
  }
  
  td {
    font-size: 14px;
    color: #334155;
  }
  
  .format-icon {
    margin-right: 8px;
  }
  
  .btn-link {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: 14px;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  .btn-link:hover {
    background: #eff6ff;
  }
  
  .format-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  
  .format-card {
    text-align: center;
    padding: 30px 20px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }
  
  .format-card .format-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  
  .format-card h4 {
    margin: 0 0 6px;
    font-size: 18px;
    color: #1e293b;
  }
  
  .format-card p {
    margin: 0;
    font-size: 13px;
    color: #64748b;
  }
  
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #94a3b8;
  }
  
  .empty-state p {
    margin: 12px 0 0;
    font-size: 16px;
  }
  
  .empty-state .hint {
    font-size: 14px;
    color: #cbd5e1;
    margin-top: 8px;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px;
    color: #64748b;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .loading p {
    margin-top: 16px;
    font-size: 16px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
