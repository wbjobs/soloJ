<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { appStore, selectedBook, rearrangedBook, styleConfig } from '../stores/appStore';
  import { rearrangeStyle, exportToHtml, saveSearchIndex, checkDrm, removeDrm } from '../utils/tauriApi';
  import { formatFileSize, getStateLabel, getStateColor, themes } from '../utils/helpers';
  import StylePanel from '../components/StylePanel.svelte';
  import { 
    ArrowLeft, 
    Download, 
    Search, 
    Shield,
    ShieldCheck,
    ShieldX,
    RefreshCw,
    Split,
    FileText,
    BookOpen,
    Settings
  } from 'lucide-svelte';
  import { save } from '@tauri-apps/api/dialog';
  import type { DrmInfo } from '../types';
  
  let showStylePanel = false;
  let viewMode: 'split' | 'original' | 'rearranged' = 'split';
  let currentChapterIndex = 0;
  let drmInfo: DrmInfo | null = null;
  let originalScrollTop = 0;
  let rearrangedScrollTop = 0;
  
  let originalFrame: HTMLIFrameElement;
  let rearrangedFrame: HTMLIFrameElement;
  
  async function processBook() {
    if (!$selectedBook) return;
    
    $appStore.setProcessing(true);
    $appStore.setError(null);
    
    try {
      const result = await rearrangeStyle(
        $selectedBook.chapters,
        $styleConfig,
        $selectedBook.cssStyles
      );
      result.metadata = $selectedBook.metadata;
      $appStore.setRearrangedBook(result);
      
      try {
        await saveSearchIndex($selectedBook);
      } catch (idxErr) {
        console.warn('Index save failed, continuing:', idxErr);
      }
    } catch (err: any) {
      $appStore.setError(err.message || '样式重排失败');
    } finally {
      $appStore.setProcessing(false);
    }
  }
  
  async function checkBookDrm() {
    if (!$selectedBook) return;
    
    try {
      drmInfo = await checkDrm($selectedBook.sourcePath);
    } catch (err: any) {
      console.error('DRM check failed:', err);
    }
  }
  
  async function handleRemoveDrm() {
    if (!$selectedBook) return;
    
    $appStore.setProcessing(true);
    $appStore.setError(null);
    
    try {
      const outputPath = await removeDrm($selectedBook.sourcePath);
      const { parseEbook } = await import('../utils/tauriApi');
      const newBook = await parseEbook(outputPath);
      newBook.drmRemoved = true;
      $appStore.setSelectedBook(newBook);
      
      drmInfo = await checkDrm(outputPath);
      
      await processBook();
    } catch (err: any) {
      $appStore.setError(err.message || 'DRM 移除失败');
    } finally {
      $appStore.setProcessing(false);
    }
  }
  
  async function exportBook() {
    if (!$rearrangedBook) return;
    
    try {
      const defaultName = `${$rearrangedBook.metadata.title || 'ebook'}.html`;
      const outputPath = await save({
        filters: [{ name: 'HTML', extensions: ['html'] }],
        defaultPath: defaultName
      });
      
      if (outputPath) {
        await exportToHtml($rearrangedBook, outputPath);
      }
    } catch (err: any) {
      $appStore.setError(err.message || '导出失败');
    }
  }
  
  function goToSearch() {
    $appStore.setView('search');
  }
  
  function goBack() {
    $appStore.setView('library');
    $appStore.setSelectedBook(null);
    $appStore.setRearrangedBook(null);
  }
  
  function buildOriginalHtml(): string {
    if (!$selectedBook) return '';
    
    const metadata = $selectedBook.metadata;
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${metadata.title}</title>
        <style>
          body {
            font-family: serif;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1, h2, h3 { margin-top: 1.5em; }
          h1 { font-size: 28px; }
          h2 { font-size: 24px; }
          h3 { font-size: 20px; }
          p { margin: 0 0 1em; text-indent: 2em; }
          .chapter { margin-bottom: 3em; }
          .chapter-title { 
            text-align: center; 
            padding-bottom: 0.5em;
            border-bottom: 1px solid #ddd;
            margin-bottom: 1em;
          }
        </style>
        ${$selectedBook.cssStyles.map(c => `<style>${c}</style>`).join('\n')}
      </head>
      <body>
    `;
    
    for (const chapter of $selectedBook.chapters) {
      html += `
        <div class="chapter" id="ch-${chapter.id}">
          <h1 class="chapter-title">${chapter.title}</h1>
      `;
      
      for (const elem of chapter.elements) {
        html += renderElementOriginal(elem);
      }
      
      html += `</div>`;
    }
    
    html += `
      </body>
      </html>
    `;
    
    return html;
  }
  
  function renderElementOriginal(elem: any, depth = 0): string {
    const tag = elem.elementType || 'div';
    if (tag === 'text') return escapeHtml(elem.content);
    
    let html = `<${tag}`;
    
    for (const [key, val] of Object.entries(elem.attributes || {})) {
      if (key !== 'style') html += ` ${key}="${escapeHtml(val as string)}"`;
    }
    
    if (elem.style) {
      const style = `font-family: ${elem.style.fontFamily}; font-size: ${elem.style.fontSize}px; font-weight: ${elem.style.fontWeight}; color: ${elem.style.color};`;
      html += ` style="${style}"`;
    }
    
    html += '>';
    
    if (elem.content) html += escapeHtml(elem.content);
    
    for (const child of elem.children || []) {
      html += renderElementOriginal(child, depth + 1);
    }
    
    html += `</${tag}>`;
    
    return html;
  }
  
  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  $: if ($selectedBook && !drmInfo) {
    checkBookDrm();
  }
  
  $: if ($selectedBook && !$rearrangedBook && !$appStore.isProcessing) {
    processBook();
  }
  
  $: originalHtml = buildOriginalHtml();
  $: rearrangedHtml = $rearrangedBook?.htmlContent || '';
  
  let originalHtml: string;
  let rearrangedHtml: string;
  
  function syncScroll(source: 'original' | 'rearranged') {
    const sourceFrame = source === 'original' ? originalFrame : rearrangedFrame;
    const targetFrame = source === 'original' ? rearrangedFrame : originalFrame;
    
    if (!sourceFrame?.contentDocument || !targetFrame?.contentDocument) return;
    
    const sourceDoc = sourceFrame.contentDocument;
    const targetDoc = targetFrame.contentDocument;
    
    const sourceScroll = sourceDoc.scrollingElement?.scrollTop || 0;
    const sourceHeight = (sourceDoc.scrollingElement?.scrollHeight || 1) - (sourceDoc.scrollingElement?.clientHeight || 1);
    const ratio = sourceScroll / Math.max(sourceHeight, 1);
    
    const targetHeight = (targetDoc.scrollingElement?.scrollHeight || 1) - (targetDoc.scrollingElement?.clientHeight || 1);
    if (targetDoc.scrollingElement) {
      targetDoc.scrollingElement.scrollTop = ratio * targetHeight;
    }
  }

  function scrollToChapter(anchor: string) {
    if (rearrangedFrame?.contentDocument) {
      const el = rearrangedFrame.contentDocument.getElementById(anchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
    currentChapterIndex = $rearrangedBook?.chapterNavigation?.findIndex(([_, a]) => a === anchor) || 0;
  }
</script>

<div class="reader-view">
  <header class="reader-header">
    <div class="header-left">
      <button class="icon-btn" on:click={goBack} title="返回书库">
        <ArrowLeft size={20} />
      </button>
      
      {#if $selectedBook}
        <div class="book-info">
          <h2>{$selectedBook.metadata.title || '未知标题'}</h2>
          <p>
            {$selectedBook.metadata.authors.join(', ') || '未知作者'}
            <span class="separator">·</span>
            <span class="format">{$selectedBook.originalFormat}</span>
            <span class="separator">·</span>
            <span>{formatFileSize($selectedBook.metadata.fileSize)}</span>
            {#if $selectedBook.drmRemoved}
              <span class="separator">·</span>
              <span class="drm-removed"><ShieldCheck size={14} /> DRM已移除</span>
            {/if}
          </p>
        </div>
      {/if}
    </div>
    
    <div class="header-center">
      <div class="view-toggle">
        <button 
          class={viewMode === 'split' ? 'active' : ''} 
          on:click={() => viewMode = 'split'}
          title="双栏对比"
        >
          <Split size={16} />
        </button>
        <button 
          class={viewMode === 'original' ? 'active' : ''} 
          on:click={() => viewMode = 'original'}
          title="原版视图"
        >
          <FileText size={16} />
        </button>
        <button 
          class={viewMode === 'rearranged' ? 'active' : ''} 
          on:click={() => viewMode = 'rearranged'}
          title="重排视图"
        >
          <BookOpen size={16} />
        </button>
      </div>
    </div>
    
    <div class="header-right">
      {#if drmInfo}
        {#if drmInfo.isProtected}
          <button 
            class="btn danger" 
            on:click={handleRemoveDrm}
            disabled={!drmInfo.canRemove}
            title={drmInfo.canRemove ? '移除DRM' : '需要配置Calibre和DeDRM插件'}
          >
            <ShieldX size={16} />
            移除DRM
          </button>
        {:else}
          <span class="status-badge success">
            <ShieldCheck size={14} />
            无DRM保护
          </span>
        {/if}
      {/if}
      
      <button class="icon-btn" on:click={processBook} title="重新排版">
        <RefreshCw size={20} />
      </button>
      
      <button class="icon-btn" on:click={goToSearch} title="全文搜索">
        <Search size={20} />
      </button>
      
      <button 
        class="icon-btn" 
        on:click={() => showStylePanel = !showStylePanel}
        class:active={showStylePanel}
        title="样式设置"
      >
        <Settings size={20} />
      </button>
      
      <button 
        class="btn primary" 
        on:click={exportBook}
        disabled={!$rearrangedBook}
      >
        <Download size={16} />
        导出HTML
      </button>
    </div>
  </header>
  
  {#if showStylePanel}
    <StylePanel />
  {/if}
  
  <div class="reader-content" class:with-panel={showStylePanel}>
    {#if viewMode === 'split' || viewMode === 'original'}
      <div class="pane original-pane" class:hidden={viewMode !== 'split' && viewMode !== 'original'}>
        <div class="pane-header">
          <span class="pane-title">原始版式</span>
        </div>
        <div class="pane-content">
          <iframe
            bind:this={originalFrame}
            srcdoc={originalHtml}
            on:scroll={() => syncScroll('original')}
          />
        </div>
      </div>
    {/if}
    
    {#if viewMode === 'split'}
      <div class="pane-divider"></div>
    {/if}
    
    {#if viewMode === 'split' || viewMode === 'rearranged'}
      <div class="pane rearranged-pane" class:hidden={viewMode !== 'split' && viewMode !== 'rearranged'}>
        <div class="pane-header">
          <span class="pane-title">重排版式</span>
          {#if $rearrangedBook}
            <span class="chapter-nav">
              {#each $rearrangedBook.chapterNavigation as [title, anchor], i}
                <a 
                  href="#{anchor}" 
                  class:active={i === currentChapterIndex}
                  on:click|preventDefault={() => scrollToChapter(anchor)}
                >
                  {title}
                </a>
              {/each}
            </span>
          {/if}
        </div>
        <div class="pane-content">
          {#if $rearrangedBook}
            <iframe
              bind:this={rearrangedFrame}
              srcdoc={rearrangedHtml}
              on:scroll={() => syncScroll('rearranged')}
            />
          {:else}
            <div class="empty-reader">
              <RefreshCw size={32} class="spinning" />
              <p>正在进行智能排版...</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

{#if !$selectedBook}
  <div class="no-book-selected">
    <BookOpen size={64} />
    <h3>请选择一本电子书</h3>
    <p>从书库中打开或拖入电子书文件</p>
  </div>
{/if}

<style>
  .reader-view {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f1f5f9;
  }
  
  .reader-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    flex-shrink: 0;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }
  
  .icon-btn {
    background: none;
    border: none;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  
  .icon-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
  
  .icon-btn.active {
    background: #dbeafe;
    color: #3b82f6;
  }
  
  .book-info {
    min-width: 0;
  }
  
  .book-info h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .book-info p {
    margin: 2px 0 0;
    font-size: 12px;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  
  .separator {
    color: #cbd5e1;
  }
  
  .format {
    background: #e0e7ff;
    color: #4f46e5;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }
  
  .drm-removed {
    color: #059669;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  
  .header-center {
    display: flex;
    justify-content: center;
  }
  
  .view-toggle {
    display: flex;
    background: #f1f5f9;
    border-radius: 8px;
    padding: 4px;
    gap: 2px;
  }
  
  .view-toggle button {
    background: none;
    border: none;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    color: #64748b;
    display: flex;
    align-items: center;
    transition: all 0.15s;
  }
  
  .view-toggle button:hover {
    color: #1e293b;
  }
  
  .view-toggle button.active {
    background: white;
    color: #3b82f6;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.15s;
  }
  
  .btn.primary {
    background: #3b82f6;
    color: white;
  }
  
  .btn.primary:hover:not(:disabled) {
    background: #2563eb;
  }
  
  .btn.primary:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
  }
  
  .btn.danger {
    background: #fef2f2;
    color: #dc2626;
  }
  
  .btn.danger:hover:not(:disabled) {
    background: #fee2e2;
  }
  
  .btn.danger:disabled {
    background: #f1f5f9;
    color: #94a3b8;
    cursor: not-allowed;
  }
  
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .status-badge.success {
    background: #dcfce7;
    color: #16a34a;
  }
  
  .reader-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    transition: padding-right 0.3s;
  }
  
  .reader-content.with-panel {
    padding-right: 0;
  }
  
  .pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: white;
    overflow: hidden;
  }
  
  .pane.hidden {
    display: none;
  }
  
  .pane-header {
    padding: 10px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  
  .pane-title {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .chapter-nav {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    max-width: 60%;
  }
  
  .chapter-nav a {
    padding: 4px 10px;
    font-size: 12px;
    color: #64748b;
    text-decoration: none;
    border-radius: 4px;
    white-space: nowrap;
    transition: all 0.15s;
  }
  
  .chapter-nav a:hover {
    background: #e2e8f0;
  }
  
  .chapter-nav a.active {
    background: #3b82f6;
    color: white;
  }
  
  .pane-content {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  
  .pane-content iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
  
  .pane-divider {
    width: 4px;
    background: #e2e8f0;
    cursor: col-resize;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  
  .pane-divider:hover {
    background: #3b82f6;
  }
  
  .empty-reader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
  }
  
  .empty-reader :global(.spinning) {
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
    color: #3b82f6;
  }
  
  .no-book-selected {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
    color: #64748b;
  }
  
  .no-book-selected h3 {
    margin: 16px 0 8px;
    font-size: 20px;
    color: #334155;
  }
  
  .no-book-selected p {
    margin: 0;
    font-size: 14px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
