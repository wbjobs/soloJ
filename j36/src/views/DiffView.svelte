<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from '../stores/appStore';
  import type { ParsedBook, DiffConfig, DiffReport, ChapterDiff } from '../types';
  import {
    compareBookVersions, exportDiffReport, getDefaultDiffConfig } from '../utils/tauriApi';
  import { open, save } from '@tauri-apps/api/dialog';
  import { parseEbook } from '../utils/tauriApi';

  let oldBookPath = '';
  let newBookPath = '';
  let oldBook: ParsedBook | null = null;
  let newBook: ParsedBook | null = null;
  let diffConfig: DiffConfig | null = null;
  let diffReport: DiffReport | null = null;
  let isProcessing = false;
  let errorMessage = '';
  let selectedChapterId = '';
  let showOnlyChanged = true;

  onMount(async () => {
    try {
      diffConfig = await getDefaultDiffConfig();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '初始化失败';
    }
  });

  const selectOldBook = async () => {
    const selected = await open({
      filters: [
        { name: '电子书', extensions: ['pdf', 'epub', 'azw3', 'mobi'] },
      ],
      multiple: false,
    });

    if (selected && typeof selected === 'string') {
      oldBookPath = selected;
      oldBook = null;
      diffReport = null;
      await loadOldBook(selected);
    }
  };

  const selectNewBook = async () => {
    const selected = await open({
      filters: [
        { name: '电子书', extensions: ['pdf', 'epub', 'azw3', 'mobi'] },
      ],
      multiple: false,
    });

    if (selected && typeof selected === 'string') {
      newBookPath = selected;
      newBook = null;
      diffReport = null;
      await loadNewBook(selected);
    }
  };

  const loadOldBook = async (path: string) => {
    isProcessing = true;
    errorMessage = '';
    try {
      oldBook = await parseEbook(path);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '加载书籍失败';
    } finally {
      isProcessing = false;
    }
  };

  const loadNewBook = async (path: string) => {
    isProcessing = true;
    errorMessage = '';
    try {
      newBook = await parseEbook(path);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '加载书籍失败';
    } finally {
      isProcessing = false;
    }
  };

  const startComparison = async () => {
    if (!oldBook || !newBook || !diffConfig) return;

    isProcessing = true;
    errorMessage = '';

    try {
      const oldLabel = oldBook.metadata.title || '旧版本';
      const newLabel = newBook.metadata.title || '新版本';
      
      diffReport = await compareBookVersions(
        oldBook,
        newBook,
        oldLabel,
        newLabel,
        diffConfig
      );

      if (diffReport.chapterDiffs.length > 0) {
        selectedChapterId = diffReport.chapterDiffs[0].chapterId;
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '对比失败';
    } finally {
      isProcessing = false;
    }
  };

  const exportReport = async (format: string) => {
    if (!diffReport) return;

    const ext = format === 'html' ? 'html' : format === 'markdown' ? 'md' : 'json';
    const outputPath = await save({
      filters: [
        { name: format.toUpperCase(), extensions: [ext] },
      ],
    });

    if (outputPath) {
      try {
        await exportDiffReport(diffReport, outputPath, format);
        alert('导出成功！');
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : '导出失败';
      }
    }
  };

  const backToLibrary = () => {
    appStore.update((state) => ({
      ...state,
      currentView: 'library',
    }));
  };

  const getDiffTypeClass = (diffType: string) => {
    switch (diffType) {
      case 'Added':
        return 'diff-added';
      case 'Removed':
        return 'diff-removed';
      case 'Modified':
        return 'diff-modified';
      default:
        return 'diff-unchanged';
    }
  };

  const getDiffTypeLabel = (diffType: string) => {
    const labels: Record<string, string> = {
      Added: '新增',
      Removed: '删除',
      Modified: '修改',
      Unchanged: '未变',
    };
    return labels[diffType] || diffType;
  };

  $: filteredChapters = diffReport?.chapterDiffs.filter(
    (chapter) => !showOnlyChanged || chapter.hasChanges
  );

  $: currentChapter = diffReport?.chapterDiffs.find(
    (chapter) => chapter.chapterId === selectedChapterId
  ) || null;
</script>

<div class="diff-view">
  <div class="header">
    <button class="back-btn" on:click={backToLibrary}>← 返回书库</button>
    <h1>📊 电子书版本对比</h1>
  </div>

  <div class="control-panel">
    <div class="book-selectors">
      <div class="book-selector">
        <label>旧版本 (第一版)</label>
        <div class="file-input">
          <input type="text" readonly value={oldBookPath} placeholder="选择旧版本电子书" />
          <button on:click={selectOldBook} disabled={isProcessing}>浏览...</button>
        </div>
        {#if oldBook}
          <div class="book-info">
          <span class="book-title">{oldBook.metadata.title}</span>
          <span class="book-authors">{oldBook.metadata.authors.join(', ')}</span>
        </div>
        {/if}
      </div>

      <div class="book-selector">
        <label>新版本 (第二版)</label>
        <div class="file-input">
          <input type="text" readonly value={newBookPath} placeholder="选择新版本电子书" />
          <button on:click={selectNewBook} disabled={isProcessing}>浏览...</button>
        </div>
        {#if newBook}
          <div class="book-info">
          <span class="book-title">{newBook.metadata.title}</span>
          <span class="book-authors">{newBook.metadata.authors.join(', ')}</span>
        </div>
        {/if}
      </div>
    </div>

    {#if diffConfig}
      <div class="config-section">
        <h3>对比设置</h3>
        <div class="config-grid">
          <div class="config-item">
            <label>
              <input
                type="checkbox"
                bind:checked={diffConfig.ignoreWhitespace}
                disabled={isProcessing}
              />
              忽略空白字符
            </label>
          </div>
          <div class="config-item">
            <label>
              <input
                type="checkbox"
                bind:checked={diffConfig.ignoreCase}
                disabled={isProcessing}
              />
              忽略大小写
            </label>
          </div>
          <div class="config-item">
            <label>上下文行数</label>
            <input
              type="number"
              bind:value={diffConfig.contextLines}
              min={0}
              max={10}
              disabled={isProcessing}
            />
          </div>
          <div class="config-item">
            <label>最小差异长度</label>
            <input
              type="number"
              bind:value={diffConfig.minDiffLength}
              min={1}
              max={100}
              disabled={isProcessing}
            />
          </div>
        </div>
      </div>
    {/if}

    <button
      class="compare-btn"
      on:click={startComparison}
      disabled={!oldBook || !newBook || isProcessing}
    >
      {#if isProcessing}
        <span class="spinner"></span>
        正在对比...
      {:else}
        🔍 开始对比
      {/if}
    </button>

    {#if errorMessage}
      <div class="error-message">
        ❌ {errorMessage}
      </div>
    {/if}
  </div>

  {#if diffReport}
    <div class="results-panel">
      <div class="results-header">
        <h2>对比结果</h2>
        <div class="stats">
          <span class="stat added">+ {diffReport.totalAdded}</span>
          <span class="stat removed">- {diffReport.totalRemoved}</span>
          <span class="stat modified">~ {diffReport.totalModified}</span>
          <span class="stat similarity">
            相似度: {(diffReport.overallSimilarity * 100).toFixed(1)}%</span>
        </div>
        <div class="export-buttons">
          <button on:click={() => exportReport('html')}>
            📄 导出 HTML
          </button>
          <button on:click={() => exportReport('markdown')}>
            📝 导出 Markdown
          </button>
          <button on:click={() => exportReport('json')}>
            📋 导出 JSON
          </button>
        </div>
      </div>

      <div class="diff-container">
        <div class="chapter-list">
          <div class="list-header">
            <h3>章节列表</h3>
            <label class="filter-toggle">
              <input
                type="checkbox"
                bind:checked={showOnlyChanged}
              />
              仅显示有变化
            </label>
          </div>
          <div class="chapter-items">
            {#each filteredChapters as chapter}
              <button
                class="chapter-item"
                class:active={selectedChapterId === chapter.chapterId}
                class:has-changes={chapter.hasChanges}
                on:click={() => (selectedChapterId = chapter.chapterId)}
              >
                <span class="chapter-title">{chapter.chapterTitle}</span>
                <span class="chapter-similarity">
                  {(chapter.similarityScore * 100).toFixed(0)}%
                </span>
              </button>
            {/each}
          </div>
        </div>

        {#if currentChapter}
          <div class="diff-content">
            <div class="chapter-header">
              <h3>{currentChapter.chapterTitle}</h3>
              <span class="chapter-similarity-badge">
                相似度: {(currentChapter.similarityScore * 100).toFixed(1)}%
              </span>
            </div>
            <div class="diff-segments">
              {#each currentChapter.segments as segment}
                <div class="diff-segment {getDiffTypeClass(segment.diffType)}">
                  <div class="segment-header">
                    <span class="diff-type-badge {getDiffTypeLabel(segment.diffType)}">
                      {getDiffTypeLabel(segment.diffType)}
                    </span>
                  </div>
                  <div class="segment-content">
                    {segment.content}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .diff-view {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f8f9fa;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 20px 30px;
    background: white;
    border-bottom: 1px solid #e0e0e0;
  }

  .header h1 {
    margin: 0;
    font-size: 24px;
    color: #333;
  }

  .header .back-btn {
    padding: 8px 16px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .header .back-btn:hover {
    background: #5568d3;
  }

  .control-panel {
    padding: 20px 30px;
    background: white;
    border-bottom: 1px solid #e0e0e0;
  }

  .control-panel .book-selectors {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }

  .control-panel .book-selectors .book-selector label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
  }

  .control-panel .book-selectors .book-selector .file-input {
    display: flex;
    gap: 10px;
  }

  .control-panel .book-selectors .book-selector .file-input input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  }

  .control-panel .book-selectors .book-selector .file-input button {
    padding: 10px 20px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .control-panel .book-selectors .book-selector .file-input button:hover:not(:disabled) {
    background: #5568d3;
  }

  .control-panel .book-selectors .book-selector .file-input button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .control-panel .book-selectors .book-selector .book-info {
    margin-top: 10px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .control-panel .book-selectors .book-selector .book-info .book-title {
    font-weight: 600;
    color: #333;
  }

  .control-panel .book-selectors .book-selector .book-info .book-authors {
    font-size: 13px;
    color: #666;
  }

  .control-panel .config-section {
    margin-bottom: 20px;
  }

  .control-panel .config-section h3 {
    margin: 0 0 15px 0;
    font-size: 16px;
    color: #333;
  }

  .control-panel .config-section .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
  }

  .control-panel .config-section .config-grid .config-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .control-panel .config-section .config-grid .config-item label {
    font-size: 13px;
    color: #666;
  }

  .control-panel .config-section .config-grid .config-item label input[type='checkbox'] {
    margin-right: 8px;
  }

  .control-panel .config-section .config-grid .config-item input[type='number'] {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  }

  .control-panel .config-section .config-grid .config-item input[type='number']:disabled {
    background: #f5f5f5;
  }

  .control-panel .compare-btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .control-panel .compare-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .control-panel .compare-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .control-panel .compare-btn .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .control-panel .error-message {
    margin-top: 15px;
    padding: 12px 16px;
    background: #fdecea;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    color: #721c24;
  }

  .results-panel {
    flex: 1;
    overflow: auto;
    padding: 20px 30px;
    display: flex;
    flex-direction: column;
  }

  .results-panel .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 15px;
  }

  .results-panel .results-header h2 {
    margin: 0;
    font-size: 20px;
    color: #333;
  }

  .results-panel .results-header .stats {
    display: flex;
    gap: 15px;
  }

  .results-panel .results-header .stats .stat {
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
  }

  .results-panel .results-header .stats .stat.added {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .results-panel .results-header .stats .stat.removed {
    background: #ffebee;
    color: #c62828;
  }

  .results-panel .results-header .stats .stat.modified {
    background: #fff3e0;
    color: #e65100;
  }

  .results-panel .results-header .stats .stat.similarity {
    background: #e3f2fd;
    color: #1565c0;
  }

  .results-panel .results-header .export-buttons {
    display: flex;
    gap: 10px;
  }

  .results-panel .results-header .export-buttons button {
    padding: 8px 16px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .results-panel .results-header .export-buttons button:hover {
    background: #218838;
  }

  .results-panel .diff-container {
    flex: 1;
    display: flex;
    gap: 20px;
    min-height: 0;
  }

  .results-panel .diff-container .chapter-list {
    width: 300px;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .results-panel .diff-container .chapter-list .list-header {
    padding: 15px;
    border-bottom: 1px solid #eee;
  }

  .results-panel .diff-container .chapter-list .list-header h3 {
    margin: 0 0 10px 0;
    font-size: 16px;
    color: #333;
  }

  .results-panel .diff-container .chapter-list .list-header .filter-toggle {
    font-size: 13px;
    color: #666;
  }

  .results-panel .diff-container .chapter-list .list-header .filter-toggle input {
    margin-right: 6px;
  }

  .results-panel .diff-container .chapter-list .chapter-items {
    flex: 1;
    overflow-y: auto;
  }

  .results-panel .diff-container .chapter-list .chapter-items .chapter-item {
    width: 100%;
    padding: 12px 15px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f0f0f0;
  }

  .results-panel .diff-container .chapter-list .chapter-items .chapter-item:hover {
    background: #f8f9fa;
  }

  .results-panel .diff-container .chapter-list .chapter-items .chapter-item.active {
    background: #e8f0fe;
    border-left: 3px solid #667eea;
  }

  .results-panel .diff-container .chapter-list .chapter-items .chapter-item.has-changes .chapter-title {
    font-weight: 600;
  }

  .results-panel .diff-container .chapter-list .chapter-items .chapter-item .chapter-title {
    font-size: 14px;
    color: #333;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .results-panel .diff-container .chapter-list .chapter-items .chapter-item .chapter-similarity {
    font-size: 12px;
    color: #666;
    margin-left: 10px;
  }

  .results-panel .diff-container .diff-content {
    flex: 1;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .results-panel .diff-container .diff-content .chapter-header {
    padding: 15px 20px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .results-panel .diff-container .diff-content .chapter-header h3 {
    margin: 0;
    font-size: 18px;
    color: #333;
  }

  .results-panel .diff-container .diff-content .chapter-header .chapter-similarity-badge {
    padding: 4px 12px;
    background: #e3f2fd;
    color: #1565c0;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
  }

  .results-panel .diff-container .diff-content .diff-segments {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment {
    margin-bottom: 15px;
    border-radius: 8px;
    overflow: hidden;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment.diff-added {
    border: 1px solid #a5d6a7;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment.diff-removed {
    border: 1px solid #ef9a9a;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment.diff-modified {
    border: 1px solid #ffcc80;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment.diff-unchanged {
    border: 1px solid #e0e0e0;
    opacity: 0.7;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment .segment-header {
    padding: 8px 15px;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment .segment-header .diff-type-badge {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment .segment-header .diff-type-badge.Added {
    color: #2e7d32;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment .segment-header .diff-type-badge.Removed {
    color: #c62828;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment .segment-header .diff-type-badge.Modified {
    color: #e65100;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment .segment-header .diff-type-badge.Unchanged {
    color: #757575;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment.diff-added .segment-header {
    background: #e8f5e9;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment.diff-removed .segment-header {
    background: #ffebee;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment.diff-modified .segment-header {
    background: #fff3e0;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment.diff-unchanged .segment-header {
    background: #f5f5f5;
  }

  .results-panel .diff-container .diff-content .diff-segments .diff-segment .segment-content {
    padding: 15px;
    font-size: 14px;
    line-height: 1.8;
    color: #333;
    white-space: pre-wrap;
    background: white;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
