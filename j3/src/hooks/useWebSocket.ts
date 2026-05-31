import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { OutputEvent } from '../../shared/types';

export interface UseWebSocketOptions {
  room: string;
  role: 'host' | 'viewer';
  onOutput?: (event: OutputEvent) => void;
  onHistory?: (history: OutputEvent[]) => void;
  onRoomInfo?: (info: { viewers: number; hasHost: boolean }) => void;
  onExecutionStart?: (data: { executionId: string; roomId: string }) => void;
  onExecutionEnd?: (data: { executionId: string; roomId: string; exitCode?: number }) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { room, role, onOutput, onHistory, onRoomInfo, onExecutionStart, onExecutionEnd } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_DELAY = 2000;

  const connect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
      socket.emit('join', { room, role });
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected, reason:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err: Error) => {
      console.error('WebSocket connection error:', err.message);
      setError(err.message);
      setIsConnected(false);
      reconnectAttemptsRef.current++;

      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.log('Max reconnection attempts reached');
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
      socket.emit('join', { room, role });
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_failed', () => {
      console.error('Reconnection failed');
      setError('连接失败，请刷新页面重试');
    });

    socket.on('output', (event: OutputEvent) => {
      onOutput?.(event);
    });

    socket.on('history', (history: OutputEvent[]) => {
      onHistory?.(history);
    });

    socket.on('room_info', (info: { viewers: number; hasHost: boolean }) => {
      onRoomInfo?.(info);
    });

    socket.on('execution_start', (data: { executionId: string; roomId: string }) => {
      onExecutionStart?.(data);
    });

    socket.on('execution_end', (data: { executionId: string; roomId: string; exitCode?: number }) => {
      onExecutionEnd?.(data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [room, role, onOutput, onHistory, onRoomInfo, onExecutionStart, onExecutionEnd]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
    };
  }, [connect]);

  return {
    isConnected,
    error,
    disconnect,
    reconnect: connect,
  };
}
