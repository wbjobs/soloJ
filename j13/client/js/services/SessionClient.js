export class SessionClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async getOperations(roomId, { fromSeq = 0, toSeq = null, branch = 'main', limit = 500 } = {}) {
    const params = new URLSearchParams({ fromSeq, branch, limit });
    if (toSeq !== null) params.set('toSeq', toSeq);
    const res = await fetch(`${this.baseUrl}/api/sessions/room/${roomId}/operations?${params}`);
    if (!res.ok) throw new Error(`Failed to fetch operations: ${res.status}`);
    return res.json();
  }

  async getState(roomId, { upToSeq = null, branch = 'main' } = {}) {
    const params = new URLSearchParams({ branch });
    if (upToSeq !== null) params.set('upToSeq', upToSeq);
    const res = await fetch(`${this.baseUrl}/api/sessions/room/${roomId}/state?${params}`);
    if (!res.ok) throw new Error(`Failed to fetch state: ${res.status}`);
    return res.json();
  }

  async getSnapshots(roomId, branch = 'main') {
    const res = await fetch(`${this.baseUrl}/api/sessions/room/${roomId}/snapshots?branch=${branch}`);
    if (!res.ok) throw new Error(`Failed to fetch snapshots: ${res.status}`);
    return res.json();
  }

  async getLatestSnapshot(roomId, upToSeq, branch = 'main') {
    const res = await fetch(`${this.baseUrl}/api/sessions/room/${roomId}/snapshots/latest?upToSeq=${upToSeq}&branch=${branch}`);
    if (!res.ok) throw new Error(`Failed to fetch snapshot: ${res.status}`);
    return res.json();
  }

  async createSnapshot(roomId, seq, branch = 'main') {
    const res = await fetch(`${this.baseUrl}/api/sessions/room/${roomId}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seq, branch })
    });
    if (!res.ok) throw new Error(`Failed to create snapshot: ${res.status}`);
    return res.json();
  }

  async forkSession(roomId, { sourceSeq, sourceBranch = 'main', newRoomName, forkedByUserId } = {}) {
    const res = await fetch(`${this.baseUrl}/api/sessions/room/${roomId}/fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceSeq, sourceBranch, newRoomName, forkedByUserId })
    });
    if (!res.ok) throw new Error(`Failed to fork session: ${res.status}`);
    return res.json();
  }

  async getForks(roomId) {
    const res = await fetch(`${this.baseUrl}/api/sessions/room/${roomId}/forks`);
    if (!res.ok) throw new Error(`Failed to fetch forks: ${res.status}`);
    return res.json();
  }

  async getForkSource(roomId) {
    const res = await fetch(`${this.baseUrl}/api/sessions/room/${roomId}/fork-source`);
    if (!res.ok) throw new Error(`Failed to fetch fork source: ${res.status}`);
    return res.json();
  }

  async getBranches(roomId) {
    const res = await fetch(`${this.baseUrl}/api/sessions/room/${roomId}/branches`);
    if (!res.ok) throw new Error(`Failed to fetch branches: ${res.status}`);
    return res.json();
  }
}