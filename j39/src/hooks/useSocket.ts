import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore, ForcePoint, User, Room } from '@/store/useAppStore';

interface ServerToClientEvents {
  'room:list': (rooms: Room[]) => void;
  'room:users': (users: User[]) => void;
  'room:joined': (room: Room, user: User, users: User[]) => void;
  'room:left': (userId: string) => void;
  'force:received': (force: ForcePoint) => void;
  'user:joined': (user: User) => void;
  'user:left': (userId: string) => void;
  'error': (message: string) => void;
}

interface ClientToServerEvents {
  'room:list': () => void;
  'room:create': (data: { name: string; password?: string; maxUsers?: number }) => void;
  'room:join': (data: { roomId: string; password?: string; userName: string }) => void;
  'room:leave': () => void;
  'force:send': (force: ForcePoint) => void;
  'user:update': (user: Partial<User>) => void;
}

const SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const useSocket = () => {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  const {
    connectionStatus,
    currentRoom,
    currentUser,
    setConnectionStatus,
    setCurrentRoom,
    setCurrentUser,
    setRooms,
    setUsers,
    addUser,
    removeUser,
    addForcePoint,
  } = useAppStore();

  const generateUserId = useCallback(() => {
    return `user_${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  const generateRandomColor = useCallback(() => {
    const colors = [
      '#22d3ee',
      '#818cf8',
      '#f472b6',
      '#34d399',
      '#fbbf24',
      '#f87171',
      '#a78bfa',
      '#2dd4bf',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setConnectionStatus('connecting');

    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setConnectionStatus('connected');
      socket.emit('room:list');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('error');
    });

    socket.on('room:list', (rooms) => {
      setRooms(rooms);
    });

    socket.on('room:users', (users) => {
      setUsers(users);
    });

    socket.on('room:joined', (room, user, users) => {
      setCurrentRoom(room);
      setCurrentUser(user);
      setUsers(users);
    });

    socket.on('room:left', (userId) => {
      removeUser(userId);
    });

    socket.on('user:joined', (user) => {
      addUser(user);
    });

    socket.on('user:left', (userId) => {
      removeUser(userId);
    });

    socket.on('force:received', (force) => {
      if (force.userId !== currentUser?.id) {
        addForcePoint(force);
        setTimeout(() => {
          useAppStore.getState().removeForcePoint(force.timestamp);
        }, 100);
      }
    });

    socket.on('error', (message) => {
      console.error('Socket error:', message);
    });

    socketRef.current = socket;

    return socket;
  }, [
    setConnectionStatus,
    setRooms,
    setCurrentRoom,
    setCurrentUser,
    setUsers,
    addUser,
    removeUser,
    addForcePoint,
    currentUser?.id,
  ]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionStatus('disconnected');
    setCurrentRoom(null);
    setCurrentUser(null);
    setUsers([]);
  }, [setConnectionStatus, setCurrentRoom, setCurrentUser, setUsers]);

  const fetchRooms = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('room:list');
    }
  }, []);

  const createRoom = useCallback((name: string, password?: string, maxUsers: number = 10) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('room:create', {
      name,
      password,
      maxUsers,
    });
  }, []);

  const joinRoom = useCallback((roomId: string, userName: string, password?: string) => {
    if (!socketRef.current?.connected) return;

    const userId = currentUser?.id || generateUserId();
    const color = currentUser?.color || generateRandomColor();

    if (!currentUser) {
      setCurrentUser({
        id: userId,
        name: userName,
        color,
        isHost: false,
      });
    }

    socketRef.current.emit('room:join', {
      roomId,
      password,
      userName,
    });
  }, [currentUser, generateUserId, generateRandomColor, setCurrentUser]);

  const leaveRoom = useCallback(() => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('room:leave');
    setCurrentRoom(null);
    setUsers([]);
  }, [setCurrentRoom, setUsers]);

  const sendForce = useCallback((force: Omit<ForcePoint, 'userId'>) => {
    if (!socketRef.current?.connected || !currentRoom) return;

    const forceWithUser: ForcePoint = {
      ...force,
      userId: currentUser?.id,
    };

    socketRef.current.emit('force:send', forceWithUser);
  }, [currentRoom, currentUser?.id]);

  const updateUser = useCallback((userData: Partial<User>) => {
    if (!socketRef.current?.connected || !currentUser) return;

    const updatedUser = { ...currentUser, ...userData };
    setCurrentUser(updatedUser);
    socketRef.current.emit('user:update', userData);
  }, [currentUser, setCurrentUser]);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    connectionStatus,
    currentRoom,
    currentUser,
    connect,
    disconnect,
    fetchRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    sendForce,
    updateUser,
  };
};
