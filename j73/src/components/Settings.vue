<template>
  <div class="settings">
    <h2>服务器设置</h2>

    <div class="card">
      <div class="form-group">
        <label>监听端口</label>
        <input type="number" v-model.number="localConfig.port" min="1024" max="65535" />
        <span class="hint">修改后需重启应用生效</span>
      </div>

      <div class="form-group">
        <label>最大存储容量 (GB)</label>
        <div class="input-row">
          <input type="number" v-model.number="localConfig.maxStorageGB" min="0" step="1" placeholder="0 = 无限制" />
          <span class="hint-inline">0 = 无限制</span>
        </div>
        <span class="hint">超过此容量后，新上传将返回 413 错误。按相同内容的物理存储计算（去重后）。</span>
      </div>

      <div class="form-group">
        <label>数据存储目录</label>
        <div class="input-row">
          <input type="text" v-model="localConfig.dataDir" readonly />
          <button class="btn" @click="selectDir">浏览</button>
        </div>
      </div>

      <div class="form-group">
        <label>LFS 地址</label>
        <div class="lfs-url-box">
          <code>http://&lt;本机IP&gt;:{{ localConfig.port }}/&lt;repo&gt;.git/info/lfs</code>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary" @click="save">保存设置</button>
      </div>
    </div>

    <div class="card dedup-info">
      <h3>🔗 文件去重</h3>
      <p>服务器自动通过 SHA-256 校验和对上传文件去重。相同内容的文件只保留一份物理存储，上传相同文件时仅增加引用计数。</p>
      <p>删除文件时，仅当引用计数降为 0 才会真正删除物理文件。</p>
    </div>

    <div class="card danger-zone">
      <h3>危险操作</h3>
      <p>清除所有已上传的 LFS 对象和元数据。此操作不可逆。</p>
      <button class="btn btn-danger" @click="purgeAll">清除所有数据</button>
    </div>
  </div>
</template>

<script>
import { reactive, watch } from 'vue'
import { updateConfig } from '../api'

export default {
  name: 'Settings',
  props: {
    config: Object
  },
  emits: ['update'],
  setup(props, { emit }) {
    const localConfig = reactive({
      port: 3200,
      dataDir: '',
      maxStorageGB: 0,
      ...props.config
    })

    watch(() => props.config, (val) => {
      Object.assign(localConfig, val)
    }, { deep: true })

    async function save() {
      await updateConfig(localConfig)
      emit('update', { ...localConfig })
    }

    function selectDir() {
      if (window.electronAPI) {
        window.electronAPI.selectDirectory().then(dir => {
          if (dir) localConfig.dataDir = dir
        })
      }
    }

    function purgeAll() {
      if (confirm('确定要清除所有 LFS 数据吗？此操作不可逆！')) {
        console.log('Purge requested')
      }
    }

    return { localConfig, save, selectDir, purgeAll }
  }
}
</script>

<style scoped>
.settings h2 {
  font-size: 22px;
  margin-bottom: 24px;
  font-weight: 700;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  margin-bottom: 16px;
}

.dedup-info {
  border-color: var(--primary);
  background: rgba(108, 140, 255, 0.04);
}
.dedup-info h3 {
  color: var(--primary);
  margin-bottom: 8px;
}
.dedup-info p {
  color: var(--text-dim);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 6px;
}

.danger-zone {
  border-color: var(--danger);
}
.danger-zone h3 {
  color: var(--danger);
  margin-bottom: 8px;
}
.danger-zone p {
  color: var(--text-dim);
  font-size: 14px;
  margin-bottom: 12px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  max-width: 400px;
  padding: 9px 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.form-group input:focus { border-color: var(--primary); }

.hint {
  display: block;
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}

.hint-inline {
  font-size: 13px;
  color: var(--text-dim);
  white-space: nowrap;
  align-self: center;
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  max-width: 450px;
}
.input-row input { flex: 1; }

.lfs-url-box {
  background: var(--bg);
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  max-width: 550px;
}
.lfs-url-box code {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 13px;
  color: var(--warning);
}

.btn {
  border: none;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
  background: var(--bg-hover);
  color: var(--text);
}
.btn:hover { opacity: 0.85; }

.btn-primary { background: var(--primary); color: white; }
.btn-danger { background: rgba(255, 107, 107, 0.15); color: var(--danger); }
.btn-danger:hover { background: rgba(255, 107, 107, 0.3); }

.form-actions { margin-top: 8px; }
</style>
