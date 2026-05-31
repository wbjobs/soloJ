<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from '../stores/appStore';
  import { batchProcess, scanDirectory } from '../utils/tauriApi';
  import { getStateLabel, getStateColor, formatFileSize } from '../utils/helpers';
  import { open } from '@tauri-apps/api/dialog';
  import type { BatchJob, BatchOptions, ExportFormat, StyleConfig } from '../types';
  import { 
    FolderOpen, 
    FolderPlus, 
    Play, 
    Pause,
    FileText,
    Settings,
    CheckCircle,
    XCircle,
    Clock
  } from 'lucide-svelte';
  import { v4 as uuidv4 } from 'uuid';
  
  let inputDirectory = '';
  let outputDirectory = '';
  let options: BatchOptions = {
    removeDrm: true,
    rearrangeStyle: true,
    createSearchIndex: true,
    preserveDirectoryStructure: true,
    preserveMetadata: true,
    exportFormat: 'Html',
    overwriteExisting: false,
  };
  
  let exportFormats: { label: string; value: ExportFormat }[] = [
    { label: 'HTML5', value: 'Html' },
    { label: 'EPUB', value: 'Epub' },
    { label: 'PDF', value: 'Pdf' },
    { label: 'MOBI', value: 'Mobipocket' },
  ];
  
  let jobs: BatchJob[] = [];
  let isRunning = false;
  let scannedFiles: string[] = [];
  let showSettings = false;
  
  $: totalProgress = jobs.length > 0 
    ? jobs.reduce((sum, job) => sum + (job.completedFiles + job.failedFiles), 0) / jobs.reduce((sum, job) => sum + job.totalFiles, 0) * 100
    : 0;
  
  onMount(() => {
    const lastDir = localStorage.getItem('lastBatchDirectory');
    if (lastDir) {
      inputDirectory = lastDir;
      scanForFiles();
    }
    
    const savedJobs = localStorage.getItem('batchJobs');
    if (savedJobs) {
      try {
        jobs = JSON.parse(savedJobs);
      } catch (e) {
        console.error('Failed to load batch jobs:', e);
      }
    }
  });
  
  async function selectInputDir() {
    const selected = await open({ directory: true });
    if (selected && typeof selected === 'string') {
      inputDirectory = selected;
      localStorage.setItem('lastBatchDirectory', selected);
      await scanForFiles();
    }
  }
  
  async function selectOutputDir() {
    const selected = await open({ directory: true });
    if (selected && typeof selected === 'string') {
      outputDirectory = selected;
    }
  }
  
  async function scanForFiles() {
    if (!inputDirectory) return;
    
    try {
      scannedFiles = await scanDirectory(inputDirectory, true);
    } catch (err: any) {
      $appStore.setError(err.message || '扫描目录失败');
    }
  }
  
  async function startBatch() {
    if (!inputDirectory || !outputDirectory) {
      $appStore.setError('请选择输入和输出目录');
      return;
    }
    
    if (scannedFiles.length === 0) {
      $appStore.setError('没有找到可处理的电子书文件');
      return;
    }
    
    $appStore.setProcessing(true);
    isRunning = true;
    
    const job: BatchJob = {
      id: uuidv4(),
      name: `批处理 - ${new Date().toLocaleString()}`,
      inputDirectory,
      outputDirectory,
      styleConfig: $appStore.styleConfig,
      options,
      files: scannedFiles.map(path => ({
        id: uuidv4(),
        inputPath: path,
        outputPath: null,
        status: 'Pending',
        error: null,
        progress: 0,
      })),
      status: 'Pending',
      totalFiles: scannedFiles.length,
      completedFiles: 0,
      failedFiles: 0,
    };
    
    jobs = [job, ...jobs];
    localStorage.setItem('batchJobs', JSON.stringify(jobs));
    
    try {
      const result = await batchProcess(job);
      jobs = jobs.map(j => j.id === result.id ? result : j);
      localStorage.setItem('batchJobs', JSON.stringify(jobs));
    } catch (err: any) {
      $appStore.setError(err.message || '批处理失败');
    } finally {
      $appStore.setProcessing(false);
      isRunning = false;
    }
  }
  
  function clearCompleted() {
    jobs = jobs.filter(j => j.status !== 'Completed' && j.status !== 'Failed');
    localStorage.setItem('batchJobs', JSON.stringify(jobs));
  }
  
  function removeJob(jobId: string) {
    jobs = jobs.filter(j => j.id !== jobId);
    localStorage.setItem('batchJobs', JSON.stringify(jobs));
  }
  
  function getFileProgress(file: any): string {
    if (file.status === 'Completed') return '100%';
    if (file.status === 'Failed') return '失败';
    if (file.status === 'Pending') return '等待中';
    return `${Math.round(file.progress * 100)}%`;
  }
</script>

<div class="batch-view">
  <header class="view-header">
    <h2>批处理</h2>
    <div class="header-actions">
      <button class="btn secondary" on:click={clearCompleted} disabled={isRunning}>
        清除已完成
      </button>
      <button 
        class="btn primary" 
        on:click={startBatch}
        disabled={isRunning || !inputDirectory || !outputDirectory || scannedFiles.length === 0}
      >
        <Play size={18} />
        开始处理
      </button>
    </div>
  </header>
  
  <div class="batch-content">
    <div class="config-section">
      <div class="config-card">
        <h3>目录设置</h3>
        
        <div class="form-row">
          <div class="form-group">
            <label>输入目录</label>
            <div class="input-with-btn">
              <input type="text" bind:value={inputDirectory} placeholder="选择包含电子书的目录..." readonly />
              <button class="icon-btn" on:click={selectInputDir}>
                <FolderOpen size={18} />
              </button>
            </div>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>输出目录</label>
            <div class="input-with-btn">
              <input type="text" bind:value={outputDirectory} placeholder="选择输出目录..." readonly />
              <button class="icon-btn" on:click={selectOutputDir}>
                <FolderPlus size={18} />
              </button>
            </div>
          </div>
        </div>
        
        {#if scannedFiles.length > 0}
          <div class="file-count">
            <FileText size={16} />
            <span>找到 {scannedFiles.length} 个电子书文件</span>
          </div>
        {/if}
      </div>
      
      <div class="config-card">
        <div class="card-header">
          <h3>处理选项</h3>
          <button 
            class="icon-btn" 
            on:click={() => showSettings = !showSettings}
            class:active={showSettings}
          >
            <Settings size={18} />
          </button>
        </div>
        
        <div class="options-grid">
          <label class="checkbox">
            <input type="checkbox" bind:checked={options.removeDrm} />
            <span>移除 DRM</span>
            <p class="option-desc">需要 Calibre 和 DeDRM 插件</p>
          </label>
          
          <label class="checkbox">
            <input type="checkbox" bind:checked={options.rearrangeStyle} />
            <span>智能样式重排</span>
            <p class="option-desc">优化排版，提升阅读体验</p>
          </label>
          
          <label class="checkbox">
            <input type="checkbox" bind:checked={options.createSearchIndex} />
            <span>建立搜索索引</span>
            <p class="option-desc">支持全文检索</p>
          </label>
          
          <label class="checkbox">
            <input type="checkbox" bind:checked={options.preserveDirectoryStructure} />
            <span>保持目录结构</span>
            <p class="option-desc">输出目录与输入保持一致</p>
          </label>
          
          <label class="checkbox">
            <input type="checkbox" bind:checked={options.preserveMetadata} />
            <span>保留元数据</span>
            <p class="option-desc">复制文件时间等属性</p>
          </label>
          
          <label class="checkbox">
            <input type="checkbox" bind:checked={options.overwriteExisting} />
            <span>覆盖已存在文件</span>
          </label>
        </div>
        
        {#if showSettings}
          <div class="advanced-settings">
            <div class="form-group">
              <label>导出格式</label>
              <select bind:value={options.exportFormat}>
                {#each exportFormats as fmt}
                  <option value={fmt.value}>{fmt.label}</option>
                {/each}
              </select>
            </div>
          </div>
        {/if}
      </div>
    </div>
    
    <div class="jobs-section">
      {#if jobs.length > 0}
        <div class="progress-overview">
          <div class="progress-bar">
            <div class="progress-fill" style="width: {totalProgress}%"></div>
          </div>
          <span class="progress-text">{totalProgress.toFixed(0)}%</span>
        </div>
      {/if}
      
      <div class="jobs-list">
        {#each jobs as job}
          <div class="job-card" class:expanded={job.status === 'Parsing' || job.status === 'RemovingDrm' || job.status === 'Rearranging' || job.status === 'Indexing'}>
            <div class="job-header">
              <div class="job-info">
                <h4>{job.name}</h4>
                <p>{job.inputDirectory}</p>
              </div>
              <div class="job-status">
                <span 
                  class="status-badge"
                  style="background: {getStateColor(job.status)}20; color: {getStateColor(job.status)}"
                >
                  {getStateLabel(job.status)}
                </span>
                <button class="icon-btn" on:click={() => removeJob(job.id)} disabled={isRunning}>
                  <XCircle size={18} />
                </button>
              </div>
            </div>
            
            <div class="job-stats">
              <span class="stat">
                <CheckCircle size={14} />
                {job.completedFiles} 完成
              </span>
              <span class="stat">
                <XCircle size={14} />
                {job.failedFiles} 失败
              </span>
              <span class="stat">
                <Clock size={14} />
                {job.totalFiles - job.completedFiles - job.failedFiles} 等待中
              </span>
            </div>
            
            {#if job.files.length > 0 && job.status !== 'Pending'}
              <div class="files-list">
                {#each job.files.slice(0, 5) as file}
                  <div class="file-item">
                    <div class="file-name">
                      <FileText size={14} />
                      <span>{file.inputPath.split('\\').pop()?.split('/').pop()}</span>
                    </div>
                    <div class="file-progress">
                      <div 
                        class="progress-bar small"
                        style="width: {file.progress * 100}%"
                      ></div>
                      <span class="progress-text">{getFileProgress(file)}</span>
                    </div>
                  </div>
                {/each}
                {#if job.files.length > 5}
                  <p class="more-files">还有 {job.files.length - 5} 个文件...</p>
                {/if}
              </div>
            {/if}
          </div>
        {:else}
          <div class="empty-state">
            <FileText size={48} />
            <p>还没有批处理任务</p>
            <p class="hint">选择目录并开始处理</p>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .batch-view {
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
  
  .btn.primary:hover:not(:disabled) {
    background: #2563eb;
  }
  
  .btn.primary:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
  }
  
  .btn.secondary {
    background: #e2e8f0;
    color: #1e293b;
  }
  
  .btn.secondary:hover:not(:disabled) {
    background: #cbd5e1;
  }
  
  .icon-btn {
    background: none;
    border: none;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  
  .icon-btn:hover:not(:disabled) {
    background: #f1f5f9;
    color: #1e293b;
  }
  
  .icon-btn.active {
    background: #dbeafe;
    color: #3b82f6;
  }
  
  .batch-content {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: 24px;
    align-items: start;
  }
  
  .config-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: sticky;
    top: 0;
  }
  
  .config-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .config-card h3 {
    margin: 0;
    font-size: 16px;
    color: #1e293b;
  }
  
  .form-row {
    margin-bottom: 16px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #334155;
  }
  
  .input-with-btn {
    display: flex;
    gap: 8px;
  }
  
  .input-with-btn input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 14px;
    background: #f8fafc;
    cursor: not-allowed;
  }
  
  .file-count {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: #f0fdf4;
    color: #16a34a;
    border-radius: 8px;
    font-size: 14px;
  }
  
  .options-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .checkbox {
    display: flex;
    flex-direction: column;
    gap: 2px;
    cursor: pointer;
  }
  
  .checkbox input {
    margin-right: 8px;
  }
  
  .checkbox span {
    font-size: 14px;
    color: #1e293b;
    font-weight: 500;
  }
  
  .option-desc {
    margin: 0;
    font-size: 12px;
    color: #64748b;
    margin-left: 24px;
  }
  
  .advanced-settings {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
  }
  
  .advanced-settings select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 14px;
    background: white;
  }
  
  .jobs-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .progress-overview {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }
  
  .progress-bar {
    flex: 1;
    height: 8px;
    background: #e2e8f0;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-bar.small {
    height: 4px;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    border-radius: 4px;
    transition: width 0.3s;
  }
  
  .progress-text {
    font-size: 14px;
    font-weight: 600;
    color: #3b82f6;
    min-width: 48px;
    text-align: right;
  }
  
  .jobs-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .job-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s;
  }
  
  .job-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
  
  .job-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px;
  }
  
  .job-info h4 {
    margin: 0 0 4px;
    font-size: 16px;
    color: #1e293b;
  }
  
  .job-info p {
    margin: 0;
    font-size: 12px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
  }
  
  .job-status {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .status-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .job-stats {
    display: flex;
    gap: 20px;
    padding: 0 20px 16px;
    font-size: 13px;
    color: #64748b;
  }
  
  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .files-list {
    padding: 0 20px 20px;
    border-top: 1px solid #f1f5f9;
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f8fafc;
    border-radius: 6px;
  }
  
  .file-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #334155;
    min-width: 0;
  }
  
  .file-name span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }
  
  .file-progress {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 120px;
  }
  
  .file-progress .progress-bar {
    flex: 1;
    height: 4px;
  }
  
  .file-progress .progress-text {
    font-size: 11px;
    color: #64748b;
    min-width: 50px;
    text-align: right;
  }
  
  .more-files {
    margin: 0;
    font-size: 12px;
    color: #94a3b8;
    text-align: center;
    padding: 8px;
  }
  
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #94a3b8;
    background: white;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
  }
  
  .empty-state p {
    margin: 12px 0 0;
    font-size: 16px;
    color: #64748b;
  }
  
  .empty-state .hint {
    font-size: 14px;
    color: #cbd5e1;
    margin-top: 8px;
  }
  
  @media (max-width: 1024px) {
    .batch-content {
      grid-template-columns: 1fr;
    }
    
    .config-section {
      position: static;
    }
  }
</style>
