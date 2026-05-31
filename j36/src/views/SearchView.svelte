<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore, searchResults } from '../stores/appStore';
  import { searchText, listIndexedBooks, loadSearchIndex, optimizeSearchIndex, clearSearchIndex } from '../utils/tauriApi';
  import { debounce, truncate } from '../utils/helpers';
  import { 
  Search, 
  BookOpen, 
  FileText,
  TrendingUp,
  Database,
  Trash2,
  RefreshCw
} from 'lucide-svelte';

let searchQuery = '';
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let stats: [number, number] | null = null;
let indexedBooks: [string, any][] = [];
let isSearching = false;
let indexPath = 'search_index.db';

const debouncedSearch = debounce((query: string) => {
  performSearch(query);
}, 300);

async function performSearch(query: string) {
  if (!query.trim()) {
    $appStore.setSearchResults(null);
    return;
  }

  isSearching = true;
  try {
    const results = await searchText(query, undefined, 50, 0, indexPath);
    $appStore.setSearchResults(results);
    $appStore.setSearchQuery(query);
  } catch (err: any) {
    $appStore.setError(err.message || '搜索失败');
  } finally {
    isSearching = false;
  }
}

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  searchQuery = target.value;
  debouncedSearch(searchQuery);
}

async function loadStats() {
  try {
    stats = await loadSearchIndex(indexPath);
    indexedBooks = await listIndexedBooks(indexPath, 50, 0);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function optimizeIndex() {
  try {
    await optimizeSearchIndex(indexPath);
    await loadStats();
  } catch (err: any) {
    $appStore.setError(err.message || '优化索引失败');
  }
}

async function clearIndex() {
  if (confirm('确定要清除所有搜索索引吗？此操作不可恢复。')) {
    try {
      await clearSearchIndex(indexPath);
      await loadStats();
      $appStore.setSearchResults(null);
    } catch (err: any) {
      $appStore.setError(err.message || '清除索引失败');
    }
  }
}

function openResult(bookId: string, chapterId: string) {
  console.log('Opening result:', bookId, chapterId);
  $appStore.setView('reader');
}

onMount(() => {
  loadStats();
});
</script>

<div class="search-view">
  <header class="view-header">
    <h2>全文搜索</h2>
    <div class="header-actions">
      <button class="btn secondary" on:click={loadStats}>
        <RefreshCw size={16} />
        刷新
      </button>
      <button class="btn secondary" on:click={optimizeIndex} disabled={!stats || stats[0] === 0}>
        <TrendingUp size={16} />
        优化索引
      </button>
      <button class="btn danger" on:click={clearIndex} disabled={!stats || stats[0] === 0}>
        <Trash2 size={16} />
        清除索引
      </button>
    </div>
  </header>

  <div class="search-container">
    <div class="search-box">
      <Search size={20} class="search-icon" />
      <input
        type="text"
        bind:value={searchQuery}
        on:input={handleInput}
        placeholder="搜索书名、作者、内容关键词..."
        autocomplete="off"
      />
      {#if isSearching}
        <div class="search-spinner"></div>
      {/if}
    </div>

    {#if stats}
      <div class="stats-row">
        <div class="stat-card">
          <Database size={24} />
          <div>
            <p class="stat-value">{stats[0]}</p>
            <p class="stat-label">已索引书籍</p>
          </div>
        </div>
        <div class="stat-card">
          <FileText size={24} />
          <div>
            <p class="stat-value">{stats[1]}</p>
            <p class="stat-label">文本片段</p>
          </div>
        </div>
      </div>
    {/if}

    {#if $searchResults}
      <div class="results-section">
      <div class="results-header">
        <h3>
          搜索结果
          <span class="result-count">
            找到 {$searchResults.totalResults} 个结果
            <span class="search-time">
              耗时 {$searchResults.searchTimeMs}ms
            </span>
          </span>
        </h3>
      </div>

      {#if $searchResults.results.length > 0}
        <div class="results-list">
          {#each $searchResults.results as result}
            <div 
              class="result-card"
              on:click={() => openResult(result.bookId, result.chapterId)}
            >
              <div class="result-header">
                <BookOpen size={18} />
                <span class="chapter">{result.chapterTitle}</span>
                <span class="score">相关度 {(result.score * 100).toFixed(0)}%</span>
              </div>
              <div class="result-snippet">
                {@html result.snippet}
              </div>
              <div class="result-footer">
                {#each indexedBooks as [id, metadata]}
                  {#if id === result.bookId}
                    <span class="book-title">{metadata.title}</span>
                  {/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="no-results">
          <Search size={48} />
          <p>没有找到相关结果</p>
          <p class="hint">试试其他关键词，或检查书籍是否已建立索引</p>
        </div>
      {/if}
      </div>
    {/if}

    {#if !$searchResults && indexedBooks.length > 0}
      <div class="indexed-section">
        <h3>已索引书籍</h3>
        <div class="books-grid">
          {#each indexedBooks as [id, metadata]}
            <div class="book-item" on:click={() => openResult(id, '')}>
              <div class="book-icon">📖</div>
              <div class="book-info">
                <h4>{truncate(metadata.title, 30)}</h4>
                <p>{metadata.authors?.join(', ') || '未知作者'}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if !$searchResults && indexedBooks.length === 0}
      <div class="empty-state">
        <Database size={48} />
        <p>还没有任何书籍索引</p>
        <p class="hint">打开书籍并处理后，将自动建立索引</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .search-view {
    padding: 30px;
    max-width: 1000px;
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
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn.secondary {
    background: #e2e8f0;
    color: #1e293b;
  }

  .btn.secondary:hover:not(:disabled) {
    background: #cbd5e1;
  }

  .btn.secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.danger {
    background: #fef2f2;
    color: #dc2626;
  }

  .btn.danger:hover:not(:disabled) {
    background: #fee2e2;
  }

  .search-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 4px 16px;
    transition: all 0.2s;
  }

  .search-box:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }

  .search-box :global(.search-icon) {
    color: #94a3b8;
    margin-right: 12px;
    flex-shrink: 0;
  }

  .search-box input {
    flex: 1;
    padding: 14px 0;
    border: none;
    background: none;
    font-size: 16px;
    outline: none;
    color: #1e293b;
  }

  .search-box input::placeholder {
    color: #94a3b8;
  }

  .search-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    color: #3b82f6;
  }

  .stat-value {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #1e293b;
  }

  .stat-label {
    margin: 2px 0 0;
    font-size: 13px;
    color: #64748b;
  }

  .results-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .results-header h3 {
    margin: 0;
    font-size: 18px;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .result-count {
    font-size: 13px;
    color: #64748b;
    font-weight: normal;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .search-time {
    font-size: 12px;
    color: #94a3b8;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .result-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .result-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    color: #64748b;
    font-size: 14px;
  }

  .result-header .chapter {
    font-weight: 500;
    color: #1e293b;
  }

  .result-header .score {
    margin-left: auto;
    padding: 2px 8px;
    background: #dbeafe;
    color: #3b82f6;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .result-snippet {
    font-size: 14px;
    line-height: 1.7;
    color: #334155;
    margin-bottom: 12px;
  }

  .result-snippet :global(.highlight) {
    background: #fef08a;
    padding: 0 2px;
    border-radius: 2px;
  }

  .result-footer {
    font-size: 12px;
    color: #94a3b8;
    border-top: 1px solid #f1f5f9;
    padding-top: 12px;
  }

  .book-title {
    font-weight: 500;
    color: #64748b;
  }

  .no-results,
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    color: #94a3b8;
  }

  .no-results p,
  .empty-state p {
    margin: 12px 0 0;
    font-size: 16px;
    color: #64748b;
  }

  .no-results .hint,
  .empty-state .hint {
    font-size: 14px;
    color: #cbd5e1;
    margin-top: 8px;
  }

  .indexed-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .indexed-section h3 {
    margin: 0;
    font-size: 16px;
    color: #334155;
  }

  .books-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
  }

  .book-item {
    display: flex;
    gap: 14px;
    padding: 16px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .book-item:hover {
    border-color: #3b82f6;
    background: #f8fafc;
  }

  .book-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .book-info h4 {
    margin: 0 0 4px;
    font-size: 14px;
    color: #1e293b;
  }

  .book-info p {
    margin: 0;
    font-size: 12px;
    color: #64748b;
  }
</style>
