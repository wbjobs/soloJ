<template>
  <div class="setup-guide">
    <h2>Git LFS 客户端配置指南</h2>

    <div class="card">
      <h3>1. 安装 Git LFS</h3>
      <p>确保已安装 Git LFS（v2.5.0+）：</p>
      <pre><code>git lfs install</code></pre>
    </div>

    <div class="card">
      <h3>2. 配置 LFS 远程地址</h3>
      <p>在你的 Git 仓库中，设置 LFS 端点指向本服务器：</p>
      <pre><code>git config lfs.url {{ serverUrl }}/{{ repoName }}.git/info/lfs</code></pre>
      <p class="hint">或全局配置：</p>
      <pre><code>git config --global lfs.url {{ serverUrl }}/{{ repoName }}.git/info/lfs</code></pre>
    </div>

    <div class="card">
      <h3>3. 跟踪大文件</h3>
      <p>指定需要 LFS 管理的文件类型：</p>
      <pre><code>git lfs track "*.psd"
git lfs track "*.zip"
git lfs track "*.mp4"</code></pre>
    </div>

    <div class="card">
      <h3>4. 正常使用 Git</h3>
      <p>添加并提交文件，LFS 会自动处理大文件：</p>
      <pre><code>git add .
git commit -m "add large files"
git push origin main</code></pre>
    </div>

    <div class="card">
      <h3>5. 断点续传</h3>
      <p>本服务器支持 Git LFS 断点续传。如果上传中断，重新 push 即可续传：</p>
      <pre><code>git push origin main</code></pre>
    </div>

    <div class="card highlight">
      <h3>当前服务器地址</h3>
      <div class="server-url-box">
        <code>{{ serverUrl }}</code>
        <button class="btn btn-copy" @click="copyUrl">复制</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SetupGuide',
  props: {
    serverUrl: String
  },
  data() {
    return {
      repoName: 'myrepo'
    }
  },
  methods: {
    copyUrl() {
      navigator.clipboard.writeText(this.serverUrl)
    }
  }
}
</script>

<style scoped>
.setup-guide h2 {
  font-size: 22px;
  margin-bottom: 24px;
  font-weight: 700;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 24px;
  margin-bottom: 16px;
}

.card.highlight {
  border-color: var(--primary);
  background: rgba(108, 140, 255, 0.06);
}

.card h3 {
  font-size: 16px;
  margin-bottom: 10px;
  color: var(--primary);
}

.card p {
  color: var(--text-dim);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 8px;
}

.card .hint {
  font-size: 13px;
  color: var(--text-dim);
  opacity: 0.7;
}

pre {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 16px;
  overflow-x: auto;
  margin: 8px 0;
}

code {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 13px;
  color: var(--warning);
}

.server-url-box {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg);
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.server-url-box code {
  flex: 1;
  font-size: 14px;
}

.btn-copy {
  background: var(--primary);
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-copy:hover { background: var(--primary-dim); }
</style>
