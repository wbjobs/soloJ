<script lang="ts">
  import { appStore } from '../stores/appStore';
  import { getDefaultStyle, createReaderStyle } from '../utils/helpers';
  import type { StyleConfig } from '../types';
  import { 
    Settings as SettingsIcon,
    BookOpen,
    Shield,
    Search,
    Info,
    Folder,
    Save,
    RotateCcw
  } from 'lucide-svelte';

  let activeTab: 'reader' | 'drm' | 'search' | 'about' = 'reader';

  let calibrePath = localStorage.getItem('calibrePath') || '';
  let dedrmPluginPath = localStorage.getItem('dedrmPluginPath') || '';
  let kindleSerial = localStorage.getItem('kindleSerial') || '';
  let autoRemoveDrm = localStorage.getItem('autoRemoveDrm') === 'true';
  let defaultTheme = localStorage.getItem('defaultTheme') || 'light';

  const tabs = [
    { id: 'reader', label: '阅读设置', icon: BookOpen },
    { id: 'drm', label: 'DRM设置', icon: Shield },
    { id: 'search', label: '搜索设置', icon: Search },
    { id: 'about', label: '关于', icon: Info },
  ];

  function saveSettings() {
    localStorage.setItem('calibrePath', calibrePath);
    localStorage.setItem('dedrmPluginPath', dedrmPluginPath);
    localStorage.setItem('kindleSerial', kindleSerial);
    localStorage.setItem('autoRemoveDrm', String(autoRemoveDrm));
    localStorage.setItem('defaultTheme', defaultTheme);

    applyTheme();

    alert('设置已保存');
  }

  function resetSettings() {
    if (confirm('确定要恢复默认设置吗？')) {
      calibrePath = '';
      dedrmPluginPath = '';
      kindleSerial = '';
      autoRemoveDrm = true;
      defaultTheme = 'light';

      localStorage.removeItem('calibrePath');
      localStorage.removeItem('dedrmPluginPath');
      localStorage.removeItem('kindleSerial');
      localStorage.removeItem('autoRemoveDrm');
      localStorage.removeItem('defaultTheme');

      $appStore.setStyleConfig(getDefaultStyle());
    }
  }

  async function selectCalibrePath() {
    const { open } = await import('@tauri-apps/api/dialog');
    const selected = await open({
      directory: true,
    });
    if (selected && typeof selected === 'string') {
      calibrePath = selected;
    }
  }

  async function selectDedrmPath() {
    const { open } = await import('@tauri-apps/api/dialog');
    const selected = await open({
      filters: [{ name: 'ZIP 插件', extensions: ['zip'] }],
    });
    if (selected && typeof selected === 'string') {
      dedrmPluginPath = selected;
    }
  }

  function handleTabClick(tabId: string) {
    activeTab = tabId as 'reader' | 'drm' | 'search' | 'about';
  }

  function applyTheme() {
    if (defaultTheme) {
      const style = createReaderStyle(defaultTheme as 'light' | 'dark' | 'sepia');
      $appStore.setStyleConfig(style);
    }
  }
</script>

<div class="settings-view">
  <header class="view-header">
    <h2>设置</h2>
    <div class="header-actions">
      <button class="btn secondary" on:click={resetSettings}>
        <RotateCcw size={16} />
        恢复默认
      </button>
      <button class="btn primary" on:click={saveSettings}>
        <Save size={16} />
        保存设置
      </button>
    </div>
  </header>

  <div class="settings-container">
    <div class="settings-sidebar">
      {#each tabs as tab}
        <button
          class="tab-btn {activeTab === tab.id ? 'active' : ''}"
          on:click={() => handleTabClick(tab.id)}
        >
          <svelte:component this={tab.icon} size={18} />
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="settings-content">
      {#if activeTab === 'reader'}
        <div class="settings-section">
          <h3>阅读偏好</h3>

          <div class="form-group">
            <label>默认主题</label>
            <div class="theme-selector">
              <button
                class="theme-option {defaultTheme === 'light' ? 'active' : ''}"
                on:click={() => defaultTheme = 'light'}
              >
                <div class="theme-preview light"></div>
                <span>明亮</span>
              </button>
              <button
                class="theme-option {defaultTheme === 'sepia' ? 'active' : ''}"
                on:click={() => defaultTheme = 'sepia'}
              >
                <div class="theme-preview sepia"></div>
                <span>护眼</span>
              </button>
              <button
                class="theme-option {defaultTheme === 'dark' ? 'active' : ''}"
                on:click={() => defaultTheme = 'dark'}
              >
                <div class="theme-preview dark"></div>
                <span>夜间</span>
              </button>
            </div>
          </div>

          <div class="info-box">
            <Info size={18} />
            <p>主题设置会在下次打开书籍时生效。您也可以在阅读时随时调整样式。</p>
          </div>
        </div>
      {:else if activeTab === 'drm'}
        <div class="settings-section">
          <h3>DRM 移除设置</h3>

          <div class="warning-box">
            <Shield size={18} />
            <div>
              <p class="warning-title">重要提示</p>
              <p class="warning-text">
                DRM 移除功能仅供合法备份用途。请确保您拥有书籍的合法使用权。

                移除 DRM 需要以下工具：
              </p>
              <ul>
                <li>Calibre 电子书管理软件</li>
                <li>DeDRM 插件（用于移除 DRM）</li>
                <li>相应的 DRM 密钥文件或设备序列号</li>
              </ul>
            </div>
          </div>

          <div class="form-group">
            <label>Calibre 安装路径</label>
            <div class="input-with-btn">
              <input type="text" bind:value={calibrePath} placeholder="选择 Calibre 安装目录..." readonly />
              <button class="btn small" on:click={selectCalibrePath}>
                <Folder size={16} />
                浏览
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>DeDRM 插件路径</label>
            <div class="input-with-btn">
              <input type="text" bind:value={dedrmPluginPath} placeholder="选择 DeDRM_plugin.zip..." readonly />
              <button class="btn small" on:click={selectDedrmPath}>
                <Folder size={16} />
                浏览
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>Kindle 设备序列号（可选）</label>
            <input
              type="text"
              bind:value={kindleSerial}
              placeholder="例如: B001XXXXXXXXXXX"
            />
            <p class="hint">用于移除 Amazon DRM 的密钥生成</p>
          </div>

          <label class="checkbox">
            <input type="checkbox" bind:checked={autoRemoveDrm} />
            <span>打开书籍时自动检测并移除 DRM</span>
          </label>
        </div>
      {:else if activeTab === 'search'}
        <div class="settings-section">
          <h3>搜索设置</h3>

          <div class="form-group">
            <label>搜索索引位置</label>
            <input type="text" value="search_index.db" readonly />
            <p class="hint">索引文件保存在应用数据目录中</p>
          </div>

          <div class="info-box">
            <Search size={18} />
            <p>
              搜索引擎支持中英文混合搜索。索引会自动在处理书籍时建立。</p>
          </div>

          <div class="feature-list">
            <div class="feature-item">
              <span class="check">✓</span>
              支持模糊搜索
            </div>
            <div class="feature-item">
              <span class="check">✓</span>
              中文分词
            </div>
            <div class="feature-item">
              <span class="check">✓</span>
              搜索结果高亮显示
            </div>
            <div class="feature-item">
              <span class="check">✓</span>
              相关度排序
            </div>
          </div>
        </div>
      {:else if activeTab === 'about'}
        <div class="about-section">
          <div class="app-logo">
            <BookOpen size={64} />
            <h1>Ebook DRM Styler</h1>
            <p class="version">版本 1.0.0</p>
          </div>

          <div class="about-content">
            <p>
              一款专业的电子书 DRM 与智能排版工具。
            </p>
            
            <div class="tech-stack">
              <h4>技术栈</h4>
              <ul>
                <li><strong>前端：</strong> Svelte + TypeScript</li>
                <li><strong>后端：</strong> Rust + Tauri</li>
                <li><strong>排版引擎：</strong> C++ CSS 解析器</li>
                <li><strong>搜索：</strong> SQLite + FTS5 + jieba 分词</li>
              </ul>
            </div>

            <div class="features-grid">
              <div class="feature-card">
                <div class="feature-icon">📖</div>
                <h5>多格式支持</h5>
                <p>PDF / EPUB / AZW3 / MOBI</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon">🔓</div>
                <h5>DRM 移除</h5>
                <p>Adobe / Amazon DRM</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon">🎨</div>
                <h5>智能重排</h5>
                <p>流式 HTML5 输出</p>
              </div>
              <div class="feature-card">
                <div class="feature-icon">🔍</div>
                <h5>全文搜索</h5>
                <p>中英文分词搜索</p>
              </div>
            </div>

            <div class="disclaimer">
              <Shield size={20} />
              <div>
                <p class="disclaimer-title">法律声明</p>
                <p class="disclaimer-text">
                  本软件 DRM 功能仅供个人对合法拥有的书籍进行备份使用。
                  请遵守您所在地区的相关法律法规。
                </p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .settings-view {
    padding: 30px;
    max-width: 900px;
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

  .btn.small {
    padding: 8px 14px;
    font-size: 13px;
  }

  .settings-container {
    display: flex;
    gap: 24px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
  }

  .settings-sidebar {
    width: 200px;
    background: #f8fafc;
    border-right: 1px solid #e2e8f0;
    padding: 16px 0;
    flex-shrink: 0;
  }

  .tab-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: #64748b;
    text-align: left;
    transition: all 0.15s;
  }

  .tab-btn:hover {
    background: #e2e8f0;
    color: #1e293b;
  }

  .tab-btn.active {
    background: #dbeafe;
    color: #3b82f6;
    border-right: 3px solid #3b82f6;
  }

  .settings-content {
    flex: 1;
    padding: 30px;
    overflow-y: auto;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .settings-section h3 {
    margin: 0 0 8px;
    font-size: 20px;
    color: #1e293b;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    font-size: 14px;
    font-weight: 500;
    color: #334155;
  }

  .form-group input[type="text"] {
    padding: 10px 14px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 14px;
  }

  .input-with-btn {
    display: flex;
    gap: 8px;
  }

  .input-with-btn input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 14px;
    background: #f8fafc;
  }

  .hint {
    margin: 4px 0 0;
    font-size: 12px;
    color: #94a3b8;
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 14px;
    color: #334155;
  }

  .checkbox input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .theme-selector {
    display: flex;
    gap: 16px;
  }

  .theme-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px;
    background: none;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .theme-option:hover {
    border-color: #cbd5e1;
  }

  .theme-option.active {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .theme-preview {
    width: 60px;
    height: 40px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .theme-preview.light {
    background: #ffffff;
  }

  .theme-preview.sepia {
    background: #f4ecd8;
  }

  .theme-preview.dark {
    background: #1a1a1a;
  }

  .warning-box {
    display: flex;
    gap: 16px;
    padding: 20px;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 10px;
    color: #92400e;
  }

  .warning-title {
    margin: 0 0 8px;
    font-weight: 600;
  }

  .warning-text {
    margin: 0 0 8px;
    font-size: 14px;
    line-height: 1.6;
  }

  .warning-box ul {
    margin: 0;
    padding-left: 20px;
    font-size: 14px;
  }

  .info-box {
    display: flex;
    gap: 12px;
    padding: 16px;
    background: #dbeafe;
    border: 1px solid #93c5fd;
    border-radius: 8px;
    color: #1e40af;
    align-items: flex-start;
  }

  .info-box p {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
  }

  .feature-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: #f8fafc;
    border-radius: 8px;
    font-size: 14px;
    color: #334155;
  }

  .feature-item .check {
    color: #10b981;
    font-weight: bold;
  }

  .about-section {
    text-align: center;
  }

  .app-logo {
    margin-bottom: 24px;
    color: #3b82f6;
  }

  .app-logo h1 {
    margin: 12px 0 4px;
    font-size: 24px;
    color: #1e293b;
  }

  .version {
    margin: 0;
    font-size: 14px;
    color: #64748b;
  }

  .about-content {
    text-align: left;
  }

  .about-content > p {
    font-size: 16px;
    color: #334155;
    line-height: 1.7;
    margin-bottom: 24px;
  }

  .tech-stack {
    margin-bottom: 24px;
  }

  .tech-stack h4 {
    margin: 0 0 12px;
    font-size: 16px;
    color: #1e293b;
  }

  .tech-stack ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .tech-stack li {
    padding: 8px 0;
    font-size: 14px;
    color: #64748b;
    border-bottom: 1px solid #f1f5f9;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }

  .feature-card {
    padding: 20px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    text-align: center;
  }

  .feature-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .feature-card h5 {
    margin: 0 0 4px;
    font-size: 16px;
    color: #1e293b;
  }

  .feature-card p {
    margin: 0;
    font-size: 13px;
    color: #64748b;
  }

  .disclaimer {
    display: flex;
    gap: 16px;
    padding: 20px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    color: #64748b;
    align-items: flex-start;
  }

  .disclaimer-title {
    margin: 0 0 8px;
    font-weight: 600;
    color: #475569;
  }

  .disclaimer-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
  }
</style>
