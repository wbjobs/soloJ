export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN')
}

export function shortOid(oid) {
  return oid ? oid.substring(0, 12) + '...' : ''
}
