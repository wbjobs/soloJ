import type { Server, Socket } from 'socket.io';
import type { Room, OutputEvent } from '../../shared/types';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  getOrCreateRoom(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        viewers: [],
        outputHistory: [],
        isExecuting: false,
      };
      this.rooms.set(roomId, room);
    }
    return room;
  }

  joinRoom(roomId: string, socket: Socket, role: 'host' | 'viewer'): Room {
    const room = this.getOrCreateRoom(roomId);
    socket.join(roomId);

    if (role === 'host') {
      room.hostId = socket.id;
    } else {
      if (!room.viewers.includes(socket.id)) {
        room.viewers.push(socket.id);
      }
    }

    socket.data.roomId = roomId;
    socket.data.role = role;

    this.broadcastSystemMessage(roomId, `${role === 'host' ? '主持人' : '观众'}已加入房间`);
    this.io.to(roomId).emit('room_info', {
      viewers: room.viewers.length,
      hasHost: !!room.hostId,
    });

    return room;
  }

  leaveRoom(socket: Socket): void {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    if (socket.data.role === 'host') {
      room.hostId = undefined;
      this.broadcastSystemMessage(roomId, '主持人已离开房间');
    } else {
      room.viewers = room.viewers.filter((id) => id !== socket.id);
      this.broadcastSystemMessage(roomId, '观众已离开房间');
    }

    socket.leave(roomId);

    this.io.to(roomId).emit('room_info', {
      viewers: room.viewers.length,
      hasHost: !!room.hostId,
    });

    if (!room.hostId && room.viewers.length === 0) {
      this.rooms.delete(roomId);
    }
  }

  broadcastOutput(roomId: string, event: OutputEvent): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.outputHistory.push(event);
      if (room.outputHistory.length > 1000) {
        room.outputHistory = room.outputHistory.slice(-500);
      }
    }
    this.io.to(roomId).emit('output', event);
  }

  broadcastSystemMessage(roomId: string, message: string): void {
    const event: OutputEvent = {
      type: 'system',
      data: `[SYSTEM] ${message}`,
      timestamp: Date.now(),
      room: roomId,
    };
    this.broadcastOutput(roomId, event);
  }

  broadcastExecutionStart(roomId: string, executionId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.isExecuting = true;
    }
    this.io.to(roomId).emit('execution_start', { executionId, roomId });
  }

  broadcastExecutionEnd(roomId: string, executionId: string, exitCode: number | null): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.isExecuting = false;
    }
    this.io.to(roomId).emit('execution_end', { executionId, roomId, exitCode });
  }

  isRoomExecuting(roomId: string): boolean {
    return this.rooms.get(roomId)?.isExecuting ?? false;
  }

  getRoomHistory(roomId: string): OutputEvent[] {
    return this.rooms.get(roomId)?.outputHistory ?? [];
  }

  getViewerCount(roomId: string): number {
    return this.rooms.get(roomId)?.viewers.length ?? 0;
  }
}
