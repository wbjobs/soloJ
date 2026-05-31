import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import Annotation from '../models/Annotation.js';
import AnnotationReply from '../models/AnnotationReply.js';

const roomStates = new Map();

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join-room', async ({ roomId, userId, userName }) => {
      socket.join(roomId);

      if (!roomStates.has(roomId)) {
        roomStates.set(roomId, {
          isPlaying: false,
          currentTime: 0,
          users: new Map(),
        });
      }

      const roomState = roomStates.get(roomId);
      roomState.users.set(socket.id, { userId, userName });

      socket.emit('sync-state', {
        isPlaying: roomState.isPlaying,
        currentTime: roomState.currentTime,
      });

      io.to(roomId).emit('user-joined', {
        userId,
        userName,
        users: Array.from(roomState.users.values()),
      });

      console.log(`User ${userName} joined room ${roomId}`);
    });

    socket.on('play', ({ roomId, currentTime }) => {
      const roomState = roomStates.get(roomId);
      if (roomState) {
        roomState.isPlaying = true;
        roomState.currentTime = currentTime;
        socket.to(roomId).emit('play', { currentTime });
      }
    });

    socket.on('pause', ({ roomId, currentTime }) => {
      const roomState = roomStates.get(roomId);
      if (roomState) {
        roomState.isPlaying = false;
        roomState.currentTime = currentTime;
        socket.to(roomId).emit('pause', { currentTime });
      }
    });

    socket.on('seek', ({ roomId, currentTime }) => {
      const roomState = roomStates.get(roomId);
      if (roomState) {
        roomState.currentTime = currentTime;
        socket.to(roomId).emit('seek', { currentTime });
      }
    });

    socket.on('sync-request', ({ roomId }) => {
      const roomState = roomStates.get(roomId);
      if (roomState) {
        socket.emit('sync-state', {
          isPlaying: roomState.isPlaying,
          currentTime: roomState.currentTime,
        });
      }
    });

    socket.on('add-annotation', async ({ roomId, annotation }) => {
      try {
        const annotationId = uuidv4();
        const newAnnotation = await Annotation.create({
          id: annotationId,
          roomId,
          userId: annotation.userId,
          userName: annotation.userName,
          timestamp: annotation.timestamp,
          x: annotation.x,
          y: annotation.y,
          width: annotation.width,
          height: annotation.height,
          text: annotation.text,
        });

        const annotationToSend = {
          id: newAnnotation.id,
          userId: newAnnotation.userId,
          userName: newAnnotation.userName,
          timestamp: newAnnotation.timestamp,
          x: newAnnotation.x,
          y: newAnnotation.y,
          width: newAnnotation.width,
          height: newAnnotation.height,
          text: newAnnotation.text,
          createdAt: newAnnotation.createdAt,
        };

        io.to(roomId).emit('annotation-added', annotationToSend);
      } catch (error) {
        console.error('Add annotation error:', error);
      }
    });

    socket.on('delete-annotation', async ({ roomId, annotationId }) => {
      try {
        await Annotation.destroy({ where: { id: annotationId } });
        await AnnotationReply.destroy({ where: { annotationId } });
        io.to(roomId).emit('annotation-deleted', { annotationId });
      } catch (error) {
        console.error('Delete annotation error:', error);
      }
    });

    socket.on('add-reply', async ({ roomId, annotationId, reply }) => {
      try {
        const replyId = uuidv4();
        const newReply = await AnnotationReply.create({
          id: replyId,
          annotationId,
          userId: reply.userId,
          userName: reply.userName,
          text: reply.text,
        });

        const replyToSend = {
          id: newReply.id,
          annotationId: newReply.annotationId,
          userId: newReply.userId,
          userName: newReply.userName,
          text: newReply.text,
          createdAt: newReply.createdAt,
        };

        io.to(roomId).emit('reply-added', replyToSend);
      } catch (error) {
        console.error('Add reply error:', error);
      }
    });

    socket.on('delete-reply', async ({ roomId, replyId }) => {
      try {
        const reply = await AnnotationReply.findByPk(replyId);
        if (reply) {
          await AnnotationReply.destroy({ where: { id: replyId } });
          io.to(roomId).emit('reply-deleted', { replyId, annotationId: reply.annotationId });
        }
      } catch (error) {
        console.error('Delete reply error:', error);
      }
    });

    socket.on('toggle-annotation-visibility', ({ roomId, annotationId, isVisible }) => {
      io.to(roomId).emit('annotation-visibility-changed', { annotationId, isVisible });
    });

    socket.on('disconnect', () => {
      roomStates.forEach((roomState, roomId) => {
        const user = roomState.users.get(socket.id);
        if (user) {
          roomState.users.delete(socket.id);
          io.to(roomId).emit('user-left', {
            userId: user.userId,
            userName: user.userName,
            users: Array.from(roomState.users.values()),
          });
          console.log(`User ${user.userName} left room ${roomId}`);
        }
      });
    });
  });

  return io;
};
