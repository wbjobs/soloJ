<script lang="ts">
  import { appStore, styleConfig } from '../stores/appStore';
  import { fontFamilies, textAligments, themes } from '../utils/helpers';
  import { rearrangeStyle } from '../utils/tauriApi';
  import { Type, Layout, Palette, Columns, RotateCcw } from 'lucide-svelte';
  import type { StyleConfig } from '../types';
  
  let activeTab: 'text' | 'layout' | 'theme' | 'advanced' = 'text';
  
  async function applyStyle() {
    if (!$appStore.selectedBook) return;
    
    $appStore.setProcessing(true);
    try {
      const result = await rearrangeStyle(
        $appStore.selectedBook.chapters,
        $styleConfig,
        $appStore.selectedBook.cssStyles
      );
      result.metadata = $appStore.selectedBook.metadata;
      $appStore.setRearrangedBook(result);
    } catch (err: any) {
      $appStore.setError(err.message || '样式应用失败');
    } finally {
      $appStore.setProcessing(false);
    }
  }
  
  function resetStyle() {
    const defaultStyle: StyleConfig = {
      text: {
        fontFamily: 'Georgia, serif',
        fontSize: 16,
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#000000',
        textAlign: 'justify',
        lineHeight: 1.8,
        letterSpacing: 0,
        textIndent: 2,
      },
      layout: {
        pageWidth: 0,
        pageHeight: 0,
        marginTop: 40,
        marginBottom: 40,
        marginLeft: 50,
        marginRight: 50,
        backgroundColor: '#ffffff',
        columnCount: 1,
        columnGap: 20,
      },
      headingStyles: {
        h1: {
          fontFamily: 'Georgia, serif',
          fontSize: 28,
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          lineHeight: 1.4,
          letterSpacing: 0,
          textIndent: 0,
        },
        h2: {
          fontFamily: 'Georgia, serif',
          fontSize: 24,
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          lineHeight: 1.4,
          letterSpacing: 0,
          textIndent: 0,
        },
        h3: {
          fontFamily: 'Georgia, serif',
          fontSize: 20,
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          lineHeight: 1.4,
          letterSpacing: 0,
          textIndent: 0,
        },
      },
      customCss: null,
    };
    $appStore.setStyleConfig(defaultStyle);
    applyStyle();
  }
  
  function applyTheme(theme: typeof themes[0]) {
    $appStore.updateStyleConfig({
      text: {
        ...$styleConfig.text,
        color: theme.text,
      },
      layout: {
        ...$styleConfig.layout,
        backgroundColor: theme.bg,
      },
    });
    
    for (const heading of ['h1', 'h2', 'h3']) {
      if ($styleConfig.headingStyles[heading]) {
        $styleConfig.headingStyles[heading].color = theme.text;
      }
    }
    
    applyStyle();
  }
  
  const tabs = [
    { id: 'text', label: '字体', icon: Type },
    { id: 'layout', label: '布局', icon: Layout },
    { id: 'theme', label: '主题', icon: Palette },
    { id: 'advanced', label: '高级', icon: Columns },
  ];

  function handleTabClick(tabId: string) {
    activeTab = tabId as 'text' | 'layout' | 'theme' | 'advanced';
  }

  let customCssValue: string = '';

  $: {
    customCssValue = $styleConfig.customCss ?? '';
  }

  function updateCustomCss(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    $styleConfig.customCss = target.value || null;
    applyStyle();
  }
</script>

<div class="style-panel">
  <div class="panel-header">
    <h3>样式设置</h3>
    <button class="close-btn" on:click={() => $appStore.setView($appStore.currentView)}>
      ✕
    </button>
  </div>
  
  <div class="panel-tabs">
    {#each tabs as tab}
      <button 
        class="tab-btn {activeTab === tab.id ? 'active' : ''}"
        on:click={() => handleTabClick(tab.id)}
      >
        <svelte:component this={tab.icon} size={16} />
        {tab.label}
      </button>
    {/each}
  </div>
  
  <div class="panel-content">
    {#if activeTab === 'text'}
      <div class="form-group">
        <label>字体</label>
        <select 
          bind:value={$styleConfig.text.fontFamily}
          on:change={applyStyle}
        >
          {#each fontFamilies as font}
            <option value={font.value}>{font.label}</option>
          {/each}
        </select>
      </div>
      
      <div class="form-group">
        <label>字号: {$styleConfig.text.fontSize}px</label>
        <input 
          type="range" 
          min="12" 
          max="32" 
          bind:value={$styleConfig.text.fontSize}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>行高: {$styleConfig.text.lineHeight.toFixed(1)}</label>
        <input 
          type="range" 
          min="1.0" 
          max="3.0" 
          step="0.1"
          bind:value={$styleConfig.text.lineHeight}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>对齐方式</label>
        <select 
          bind:value={$styleConfig.text.textAlign}
          on:change={applyStyle}
        >
          {#each textAligments as align}
            <option value={align.value}>{align.label}</option>
          {/each}
        </select>
      </div>
      
      <div class="form-group">
        <label>首行缩进: {$styleConfig.text.textIndent}em</label>
        <input 
          type="range" 
          min="0" 
          max="4" 
          step="0.5"
          bind:value={$styleConfig.text.textIndent}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>字间距: {$styleConfig.text.letterSpacing}px</label>
        <input 
          type="range" 
          min="-2" 
          max="5" 
          step="0.5"
          bind:value={$styleConfig.text.letterSpacing}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>文字颜色</label>
        <input 
          type="color" 
          bind:value={$styleConfig.text.color}
          on:input={applyStyle}
        />
      </div>
    {:else if activeTab === 'layout'}
      <div class="form-group">
        <label>上边距: {$styleConfig.layout.marginTop}px</label>
        <input 
          type="range" 
          min="10" 
          max="100" 
          bind:value={$styleConfig.layout.marginTop}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>下边距: {$styleConfig.layout.marginBottom}px</label>
        <input 
          type="range" 
          min="10" 
          max="100" 
          bind:value={$styleConfig.layout.marginBottom}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>左边距: {$styleConfig.layout.marginLeft}px</label>
        <input 
          type="range" 
          min="10" 
          max="150" 
          bind:value={$styleConfig.layout.marginLeft}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>右边距: {$styleConfig.layout.marginRight}px</label>
        <input 
          type="range" 
          min="10" 
          max="150" 
          bind:value={$styleConfig.layout.marginRight}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>背景颜色</label>
        <input 
          type="color" 
          bind:value={$styleConfig.layout.backgroundColor}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>分栏数: {$styleConfig.layout.columnCount}</label>
        <input 
          type="range" 
          min="1" 
          max="3" 
          bind:value={$styleConfig.layout.columnCount}
          on:input={applyStyle}
        />
      </div>
      
      {#if $styleConfig.layout.columnCount > 1}
        <div class="form-group">
          <label>栏间距: {$styleConfig.layout.columnGap}px</label>
          <input 
            type="range" 
            min="10" 
            max="60" 
            bind:value={$styleConfig.layout.columnGap}
            on:input={applyStyle}
          />
        </div>
      {/if}
    {:else if activeTab === 'theme'}
      <div class="theme-grid">
        {#each themes as theme}
          <button 
            class="theme-card"
            class:active={
              $styleConfig.text.color === theme.text && 
              $styleConfig.layout.backgroundColor === theme.bg
            }
            on:click={() => applyTheme(theme)}
          >
            <div 
              class="theme-preview"
              style="background: {theme.bg}; color: {theme.text};"
            >
              <span class="sample-title">Aa</span>
              <p class="sample-text">示例文字</p>
            </div>
            <span>{theme.label}</span>
          </button>
        {/each}
      </div>
      
      <div class="form-group">
        <label>标题样式 - H1 字号: {$styleConfig.headingStyles.h1.fontSize}px</label>
        <input 
          type="range" 
          min="20" 
          max="48" 
          bind:value={$styleConfig.headingStyles.h1.fontSize}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>标题样式 - H2 字号: {$styleConfig.headingStyles.h2.fontSize}px</label>
        <input 
          type="range" 
          min="18" 
          max="36" 
          bind:value={$styleConfig.headingStyles.h2.fontSize}
          on:input={applyStyle}
        />
      </div>
      
      <div class="form-group">
        <label>标题样式 - H3 字号: {$styleConfig.headingStyles.h3.fontSize}px</label>
        <input 
          type="range" 
          min="16" 
          max="28" 
          bind:value={$styleConfig.headingStyles.h3.fontSize}
          on:input={applyStyle}
        />
      </div>
    {:else if activeTab === 'advanced'}
      <div class="form-group">
        <label>自定义 CSS</label>
        <textarea 
          value={customCssValue}
          placeholder="输入自定义 CSS 样式..."
          rows={10}
          on:input={updateCustomCss}
        />
        <p class="hint">自定义 CSS 将覆盖默认样式设置</p>
      </div>
      
      <div class="form-actions">
        <button class="btn secondary" on:click={resetStyle}>
          <RotateCcw size={16} />
          恢复默认
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .style-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 320px;
    background: white;
    border-left: 1px solid #e2e8f0;
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    display: flex;
    flex-direction: column;
    animation: slideIn 0.3s ease;
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    color: #1e293b;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #64748b;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  .close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
  
  .panel-tabs {
    display: flex;
    padding: 8px;
    gap: 4px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  
  .tab-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
    color: #64748b;
    transition: all 0.15s;
  }
  
  .tab-btn:hover {
    background: #e2e8f0;
    color: #1e293b;
  }
  
  .tab-btn.active {
    background: white;
    color: #3b82f6;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #334155;
  }
  
  .form-group select,
  .form-group input[type="range"],
  .form-group input[type="color"],
  .form-group textarea {
    width: 100%;
  }
  
  .form-group select {
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 14px;
    background: white;
    cursor: pointer;
  }
  
  .form-group input[type="range"] {
    height: 4px;
    accent-color: #3b82f6;
    cursor: pointer;
  }
  
  .form-group input[type="color"] {
    height: 36px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    cursor: pointer;
    padding: 2px;
  }
  
  .form-group textarea {
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 13px;
    font-family: 'Consolas', 'Monaco', monospace;
    resize: vertical;
  }
  
  .hint {
    margin: 6px 0 0;
    font-size: 11px;
    color: #94a3b8;
  }
  
  .theme-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  
  .theme-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: none;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .theme-card:hover {
    border-color: #cbd5e1;
  }
  
  .theme-card.active {
    border-color: #3b82f6;
    background: #eff6ff;
  }
  
  .theme-preview {
    width: 100%;
    aspect-ratio: 3/2;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
  }
  
  .sample-title {
    font-size: 18px;
    font-weight: bold;
  }
  
  .sample-text {
    font-size: 10px;
    margin: 4px 0 0;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
  }
  
  .btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.15s;
  }
  
  .btn.secondary {
    background: #e2e8f0;
    color: #1e293b;
  }
  
  .btn.secondary:hover {
    background: #cbd5e1;
  }
</style>
