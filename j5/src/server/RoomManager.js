const Room = require('./Room');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom() {
    const roomId = this.generateRoomId();
    const room = new Room(roomId);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  removeRoom(roomId) {
    this.rooms.delete(roomId);
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  generateRoomId() {
    let roomId;
    do {
      roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (this.rooms.has(roomId));
    return roomId;
  }

  getOrCreateRoom(roomId) {
    if (roomId && this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }
    return this.createRoom();
  }
}

module.exports = RoomManager;
