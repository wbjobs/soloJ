import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      this.socket = io({
        transports: ['websocket', 'polling'],
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(roomId, userId, userName) {
    this.socket.emit('join-room', { roomId, userId, userName });
  }

  play(roomId, currentTime) {
    this.socket.emit('play', { roomId, currentTime });
  }

  pause(roomId, currentTime) {
    this.socket.emit('pause', { roomId, currentTime });
  }

  seek(roomId, currentTime) {
    this.socket.emit('seek', { roomId, currentTime });
  }

  requestSync(roomId) {
    this.socket.emit('sync-request', { roomId });
  }

  addAnnotation(roomId, annotation) {
    this.socket.emit('add-annotation', { roomId, annotation });
  }

  deleteAnnotation(roomId, annotationId) {
    this.socket.emit('delete-annotation', { roomId, annotationId });
  }

  addReply(roomId, annotationId, reply) {
    this.socket.emit('add-reply', { roomId, annotationId, reply });
  }

  deleteReply(roomId, replyId) {
    this.socket.emit('delete-reply', { roomId, replyId });
  }

  toggleAnnotationVisibility(roomId, annotationId, isVisible) {
    this.socket.emit('toggle-annotation-visibility', { roomId, annotationId, isVisible });
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export default new SocketService();
