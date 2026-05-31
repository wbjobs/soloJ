const API_BASE = `http://${window.__LFS_HOST__ || 'localhost'}:${window.__LFS_PORT__ || 3200}`

export async function fetchFiles() {
  const res = await fetch(`${API_BASE}/api/files`)
  return res.json()
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/api/stats`)
  return res.json()
}

export async function deleteFile(oid) {
  await fetch(`${API_BASE}/api/files/${oid}`, { method: 'DELETE' })
}

export async function fetchConfig() {
  const res = await fetch(`${API_BASE}/api/config`)
  return res.json()
}

export async function updateConfig(config) {
  const res = await fetch(`${API_BASE}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  return res.json()
}
