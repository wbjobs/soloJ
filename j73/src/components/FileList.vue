<template>
  <div class="file-list">
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-label">文件数量</div>
        <div class="stat-value">{{ fileCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">占用空间</div>
        <div class="stat-value">{{ formatBytes(totalSize) }}</div>
        <div class="stat-sub" v-if="stats.maxStorageGB > 0">
          限额 {{ stats.maxStorageGB }} GB
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">磁盘可用</div>
        <div class="stat-value">{{ formatBytes(stats.diskAvailable || 0) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">去重节省</div>
        <div class="stat-value dedup-value">{{ formatBytes(stats.savedByDedup || 0) }}</div>
        <div class="stat-sub" v-if="stats.totalRefCount > stats.fileCount">
          {{ stats.totalRefCount - stats.fileCount }} 个重复引用
        </div>
      </div>
    </div>

    <div class="usage-section" v-if="stats.maxStorageGB > 0">
      <div class="usage-header">
        <span>存储空间使用</span>
        <span class="usage-text">{{ formatBytes(totalSize) }} / {{ stats.maxStorageGB }} GB</span>
      </div>
      <div class="usage-bar-large">
        <div
          class="usage-fill-large"
          :class="{ 'usage-warn': storagePercent > 80, 'usage-danger': storagePercent > 95 }"
          :style="{ width: Math.min(100, storagePercent) + '%' }"
        ></div>
      </div>
      <div class="usage-percent">{{ storagePercent.toFixed(1) }}%</div>
    </div>

    <div class="toolbar">
      <h3>已上传文件</h3>
      <button class="btn btn-primary" @click="$emit('refresh')">
        ↻ 刷新
      </button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="files.length === 0" class="empty">
      <div class="empty-icon">📦</div>
      <p>暂无上传文件</p>
      <p class="empty-hint">配置 Git LFS 客户端后，上传的大文件将显示在这里</p>
    </div>

    <table v-else class="table">
      <thead>
        <tr>
          <th>文件名</th>
          <th>OID</th>
          <th>大小</th>
          <th>引用</th>
          <th>上传时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="file in files" :key="file.oid">
          <td class="cell-filename">{{ file.filename || '—' }}</td>
          <td class="cell-oid">
            <code>{{ shortOid(file.oid) }}</code>
          </td>
          <td>{{ formatBytes(file.size) }}</td>
          <td>
            <span class="ref-badge" :class="{ 'ref-multi': file.ref_count > 1 }">
              {{ file.ref_count || 1 }}×
            </span>
          </td>
          <td>{{ formatDate(file.uploaded_at) }}</td>
          <td>
            <button class="btn btn-danger btn-sm" @click="$emit('delete', file.oid)">
              删除
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { computed } from 'vue'
import { formatBytes, formatDate, shortOid } from '../utils'

export default {
  name: 'FileList',
  props: {
    files: Array,
    loading: Boolean,
    totalSize: Number,
    fileCount: Number,
    stats: Object
  },
  emits: ['refresh', 'delete'],
  setup(props) {
    const storagePercent = computed(() => {
      if (!props.stats.maxStorageGB || props.stats.maxStorageGB <= 0) return 0
      const maxBytes = props.stats.maxStorageGB * 1024 * 1024 * 1024
      if (maxBytes === 0) return 0
      return (props.totalSize / maxBytes) * 100
    })

    return { formatBytes, formatDate, shortOid, storagePercent }
  }
}
</script>

<style scoped>
.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 20px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--primary);
}

.dedup-value {
  color: var(--success);
}

.stat-sub {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 4px;
}

.usage-section {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 20px;
  margin-bottom: 20px;
}

.usage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-dim);
}

.usage-text {
  font-weight: 600;
  color: var(--text);
}

.usage-bar-large {
  height: 10px;
  background: var(--bg);
  border-radius: 5px;
  overflow: hidden;
}

.usage-fill-large {
  height: 100%;
  background: var(--primary);
  border-radius: 5px;
  transition: width 0.5s ease;
}

.usage-fill-large.usage-warn {
  background: var(--warning);
}

.usage-fill-large.usage-danger {
  background: var(--danger);
}

.usage-percent {
  text-align: right;
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar h3 {
  font-size: 16px;
  font-weight: 600;
}

.btn {
  border: none;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: white;
}
.btn-primary:hover { background: var(--primary-dim); }

.btn-danger {
  background: rgba(255, 107, 107, 0.15);
  color: var(--danger);
}
.btn-danger:hover { background: rgba(255, 107, 107, 0.3); }

.btn-sm { padding: 4px 12px; font-size: 12px; }

.loading, .empty {
  text-align: center;
  padding: 60px 0;
  color: var(--text-dim);
}

.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-hint { font-size: 13px; margin-top: 6px; }

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.table th {
  text-align: left;
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.table tr:hover td { background: var(--bg-hover); }

.cell-filename { font-weight: 500; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-oid code {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--warning);
}

.ref-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-hover);
  color: var(--text-dim);
}

.ref-badge.ref-multi {
  background: rgba(81, 207, 102, 0.15);
  color: var(--success);
}
</style>
