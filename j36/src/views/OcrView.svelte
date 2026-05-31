<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from '../stores/appStore';
  import type { OcrConfig, OcrResult, OcrPageResult } from '../types';
  import {
    checkOcrAvailable,
    runOcr,
    exportOcrToMarkdown,
    getDefaultOcrConfig,
  } from '../utils/tauriApi';
  import { open } from '@tauri-apps/api/dialog';

  let pdfPath: string = '';
  let ocrConfig: OcrConfig | null = null;
  let ocrResult: OcrResult | null = null;
  let isProcessing = false;
  let errorMessage = '';
  let selectedPage = 0;
  let ocrAvailable = false;

  onMount(async () => {
    try {
      ocrConfig = await getDefaultOcrConfig();
      ocrAvailable = await checkOcrAvailable(ocrConfig);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : '初始化失败';
    }
  });

  const selectPdf = async () => {
    const selected = await open({
      filters: [
        {
          name: 'PDF',
          extensions: ['pdf'],
        },
      ],
      multiple: false,
    });

    if (selected && typeof selected === 'string') {
      pdfPath = selected;
      ocrResult = null;
      errorMessage = '';
    }
  };

  const startOcr = async () => {
    if (!pdfPath || !ocrConfig) return;

    isProcessing = true;
    errorMessage = '';

    try {
      ocrResult = await runOcr(pdfPath, ocrConfig);
      selectedPage = 0;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'OCR 识别失败';
    } finally {
      isProcessing = false;
    }
  };

  const exportMarkdown = async () => {
    if (!ocrResult) return;

    const { save } = await import('@tauri-apps/api/dialog');
    const outputPath = await save({
      filters: [
        {
          name: 'Markdown',
          extensions: ['md'],
        },
      ],
    });

    if (outputPath) {
      try {
        await exportOcrToMarkdown(ocrResult, outputPath);
        alert('导出成功！');
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : '导出失败';
      }
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getBlockTypeLabel = (blockType: string) => {
    const labels: Record<string, string> = {
      Title: '标题',
      Heading1: '一级标题',
      Heading2: '二级标题',
      Heading3: '三级标题',
      Paragraph: '段落',
      Table: '表格',
      TableRow: '表格行',
      TableCell: '表格单元格',
      List: '列表',
      ListItem: '列表项',
      Image: '图片',
      Footnote: '脚注',
      Unknown: '未知',
    };
    return labels[blockType] || blockType;
  };

  const backToLibrary = () => {
    appStore.update((state) => ({
      ...state,
      currentView: 'library',
    }));
  };

  $: currentPage = ocrResult?.pages[selectedPage] || null;
</script>

<div class="ocr-view">
  <div class="header">
    <button class="back-btn" on:click={backToLibrary}>← 返回书库</button>
    <h1>📷 扫描版 PDF OCR 识别</h1>
  </div>

  {#if !ocrAvailable}
    <div class="warning-box">
      <h3>⚠️ Tesseract OCR 不可用</h3>
      <p>请安装 Tesseract OCR 引擎并配置中文语言包（chi_sim）。</p>
      <p>安装方法：</p>
      <ul>
        <li>Windows: 从 <a href="https://github.com/UB-Mannheim/tesseract/wiki" target="_blank">UB-Mannheim/tesseract</a> 下载安装</li>
        <li>macOS: <code>brew install tesseract tesseract-lang</code></li>
        <li>Linux: <code>sudo apt install tesseract-ocr tesseract-ocr-chi-sim</code></li>
      </ul>
    </div>
  {/if}

  <div class="control-panel">
    <div class="file-selector">
      <label>选择 PDF 文件</label>
      <div class="file-input">
        <input type="text" readonly value={pdfPath} placeholder="点击选择扫描版 PDF 文件" />
        <button on:click={selectPdf} disabled={isProcessing}>浏览...</button>
      </div>
    </div>

    {#if ocrConfig}
      <div class="config-section">
        <h3>识别设置</h3>
        <div class="config-grid">
          <div class="config-item">
            <label>识别语言</label>
            <input
              type="text"
              bind:value={ocrConfig.languages}
              placeholder="chi_sim+eng"
              disabled={isProcessing}
            />
          </div>
          <div class="config-item">
            <label>DPI</label>
            <input
              type="number"
              bind:value={ocrConfig.dpi}
              min={72}
              max={600}
              disabled={isProcessing}
            />
          </div>
          <div class="config-item">
            <label>
              <input
                type="checkbox"
                bind:checked={ocrConfig.enableTableDetection}
                disabled={isProcessing}
              />
              启用表格检测
            </label>
          </div>
          <div class="config-item">
            <label>
              <input
                type="checkbox"
                bind:checked={ocrConfig.enableLayoutAnalysis}
                disabled={isProcessing}
              />
              启用版面分析
            </label>
          </div>
        </div>
      </div>
    {/if}

    <button
      class="start-btn"
      on:click={startOcr}
      disabled={!pdfPath || isProcessing || !ocrAvailable}
    >
      {#if isProcessing}
        <span class="spinner"></span>
        正在识别...
      {:else}
        🔍 开始 OCR 识别
      {/if}
    </button>

    {#if errorMessage}
      <div class="error-message">
        ❌ {errorMessage}
      </div>
    {/if}
  </div>

  {#if ocrResult}
    <div class="results-panel">
      <div class="results-header">
        <h2>识别结果</h2>
        <div class="stats">
          <span>总页数: {ocrResult.totalPages}</span>
          <span>平均置信度: {(ocrResult.averageConfidence * 100).toFixed(1)}%</span>
          <span>处理时间: {formatTime(ocrResult.totalProcessingTimeMs)}</span>
        </div>
        <button class="export-btn" on:click={exportMarkdown}>
          📥 导出 Markdown
        </button>
      </div>

      <div class="page-tabs">
        {#each ocrResult.pages as page, index}
          <button
            class="page-tab"
            class:active={selectedPage === index}
            on:click={() => (selectedPage = index)}
          >
            第 {page.pageNumber} 页
          </button>
        {/each}
      </div>

      {#if currentPage}
        <div class="page-content">
          <div class="page-header">
            <h3>第 {currentPage.pageNumber} 页</h3>
            <span class="confidence">置信度: {(currentPage.confidence * 100).toFixed(1)}%</span>
          </div>

          <div class="content-section">
            <h4>识别文本</h4>
            <div class="text-preview">{currentPage.text}</div>
          </div>

          {#if currentPage.layoutBlocks.length > 0}
            <div class="content-section">
              <h4>版面分析</h4>
              <div class="layout-blocks">
                {#each currentPage.layoutBlocks as block}
                  <div class="layout-block" class:table={block.blockType === 'Table'}>
                    <div class="block-header">
                      <span class="block-type">{getBlockTypeLabel(block.blockType)}</span>
                      <span class="block-confidence">{(block.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div class="block-content">{block.text}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ocr-view {
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

  .warning-box {
    margin: 20px 30px;
    padding: 20px;
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 8px;
    color: #856404;
  }

  .warning-box h3 {
    margin: 0 0 10px 0;
  }

  .warning-box ul {
    margin: 10px 0 0 0;
    padding-left: 20px;
  }

  .warning-box code {
    background: #ffeaa7;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
  }

  .control-panel {
    padding: 20px 30px;
    background: white;
    border-bottom: 1px solid #e0e0e0;
  }

  .control-panel .file-selector {
    margin-bottom: 20px;
  }

  .control-panel .file-selector label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
  }

  .control-panel .file-selector .file-input {
    display: flex;
    gap: 10px;
  }

  .control-panel .file-selector .file-input input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  }

  .control-panel .file-selector .file-input button {
    padding: 10px 20px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .control-panel .file-selector .file-input button:hover:not(:disabled) {
    background: #5568d3;
  }

  .control-panel .file-selector .file-input button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  .control-panel .config-section .config-grid .config-item input[type='text'],
  .control-panel .config-section .config-grid .config-item input[type='number'] {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  }

  .control-panel .config-section .config-grid .config-item input[type='text']:disabled,
  .control-panel .config-section .config-grid .config-item input[type='number']:disabled {
    background: #f5f5f5;
  }

  .control-panel .start-btn {
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

  .control-panel .start-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .control-panel .start-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .control-panel .start-btn .spinner {
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
    overflow-y: auto;
    padding: 20px 30px;
  }

  .results-panel .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .results-panel .results-header h2 {
    margin: 0;
    font-size: 20px;
    color: #333;
  }

  .results-panel .results-header .stats {
    display: flex;
    gap: 20px;
    font-size: 14px;
    color: #666;
  }

  .results-panel .results-header .export-btn {
    padding: 10px 20px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .results-panel .results-header .export-btn:hover {
    background: #218838;
  }

  .results-panel .page-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
  }

  .results-panel .page-tabs .page-tab {
    padding: 8px 16px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .results-panel .page-tabs .page-tab:hover {
    border-color: #667eea;
  }

  .results-panel .page-tabs .page-tab.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }

  .results-panel .page-content {
    background: white;
    border-radius: 8px;
    padding: 20px;
  }

  .results-panel .page-content .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #eee;
  }

  .results-panel .page-content .page-header h3 {
    margin: 0;
    font-size: 18px;
    color: #333;
  }

  .results-panel .page-content .page-header .confidence {
    padding: 4px 12px;
    background: #e8f5e9;
    color: #2e7d32;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
  }

  .results-panel .page-content .content-section {
    margin-bottom: 25px;
  }

  .results-panel .page-content .content-section h4 {
    margin: 0 0 12px 0;
    font-size: 15px;
    color: #555;
  }

  .results-panel .page-content .content-section .text-preview {
    padding: 15px;
    background: #f8f9fa;
    border-radius: 6px;
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-wrap;
    color: #333;
  }

  .results-panel .page-content .layout-blocks {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .results-panel .page-content .layout-blocks .layout-block {
    padding: 12px 15px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
  }

  .results-panel .page-content .layout-blocks .layout-block.table {
    border-color: #ffc107;
    background: #fffef5;
  }

  .results-panel .page-content .layout-blocks .layout-block .block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .results-panel .page-content .layout-blocks .layout-block .block-header .block-type {
    padding: 2px 10px;
    background: #667eea;
    color: white;
    border-radius: 12px;
    font-size: 12px;
  }

  .results-panel .page-content .layout-blocks .layout-block .block-header .block-confidence {
    font-size: 12px;
    color: #666;
  }

  .results-panel .page-content .layout-blocks .layout-block .block-content {
    font-size: 14px;
    line-height: 1.6;
    color: #333;
    white-space: pre-wrap;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
