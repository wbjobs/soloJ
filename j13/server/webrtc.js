class WebRTCConnectionPool {
  constructor() {
    this.connections = new Map();
  }

  addConnection(roomId, userId, peerConnection) {
    const key = `${roomId}:${userId}`;
    this.connections.set(key, {
      peerConnection,
      roomId,
      userId,
      createdAt: new Date()
    });
  }

  removeConnection(roomId, userId) {
    const key = `${roomId}:${userId}`;
    const conn = this.connections.get(key);
    if (conn) {
      if (conn.peerConnection && conn.peerConnection.close) {
        try { conn.peerConnection.close(); } catch (e) {}
      }
      this.connections.delete(key);
    }
  }

  getConnection(roomId, userId) {
    return this.connections.get(`${roomId}:${userId}`);
  }

  getRoomConnections(roomId) {
    const result = [];
    for (const [key, value] of this.connections.entries()) {
      if (value.roomId === roomId) {
        result.push(value);
      }
    }
    return result;
  }

  removeRoomConnections(roomId) {
    for (const [key, value] of this.connections.entries()) {
      if (value.roomId === roomId) {
        if (value.peerConnection && value.peerConnection.close) {
          try { value.peerConnection.close(); } catch (e) {}
        }
        this.connections.delete(key);
      }
    }
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      rooms: new Set(
        [...this.connections.values()].map(c => c.roomId)
      ).size
    };
  }
}

module.exports = new WebRTCConnectionPool();
