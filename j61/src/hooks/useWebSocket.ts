import { useEffect, useRef, useCallback } from 'react';
import type { LogEntry, WebSocketMessage, AlertMessage } from '../../shared/types';
import { useLogStore } from '../store/useLogStore';

const WS_URL = 'ws://localhost:3001/ws';
const BATCH_INTERVAL = 100;
const MAX_BATCH_SIZE = 100;
const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_ATTEMPTS = 10;

async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied') {
    return false;
  }
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

function showDesktopNotification(alert: AlertMessage): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  try {
    new Notification(alert.title, {
      body: alert.message,
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMzIgNEMxNi41MzYgNCA0IDE2LjUzNiA0IDMyQzQgNDcuNDY0IDE2LjUzNiA2MCAzMiA2MEM0Ny40NjQgNjAgNjAgNDcuNDY0IDYwIDMyQzYwIDE2LjUzNiA0Ny40NjQgNCAzMiA0WiIgZmlsbD0iI0ZGRjNGNSIvPjxwYXRoIGQ9Ik0zMiAyNFYzNk0zMiA0NEgzMi4wMSIgc3Ryb2tlPSIjRkYzMTMxIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==',
      tag: alert.id,
    });
  } catch (e) {
    console.error('Failed to show notification:', e);
  }
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const batchBufferRef = useRef<LogEntry[]>([]);
  const batchTimerRef = useRef<number | null>(null);
  const addLogs = useLogStore((state) => state.addLogs);
  const setLogs = useLogStore((state) => state.setLogs);
  const setConnected = useLogStore((state) => state.setConnected);
  const triggerAlert = useLogStore((state) => state.triggerAlert);
  const alertEnabled = useLogStore((state) => state.alertEnabled);

  const flushBatch = useCallback(() => {
    if (batchBufferRef.current.length > 0) {
      const logs = [...batchBufferRef.current];
      batchBufferRef.current = [];
      addLogs(logs);
    }
    batchTimerRef.current = null;
  }, [addLogs]);

  const queueLog = useCallback(
    (log: LogEntry) => {
      batchBufferRef.current.push(log);
      if (batchBufferRef.current.length >= MAX_BATCH_SIZE) {
        flushBatch();
      } else if (!batchTimerRef.current) {
        batchTimerRef.current = window.setTimeout(flushBatch, BATCH_INTERVAL);
      }
    },
    [flushBatch]
  );

  const connect = useCallback(() => {
    if (isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached, stopping reconnection');
      return;
    }

    isConnectingRef.current = true;

    try {
      console.log('Attempting WebSocket connection to:', WS_URL, 'Attempt:', reconnectAttemptsRef.current + 1);
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setConnected(true);
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current);
          reconnectRef.current = null;
        }
        requestNotificationPermission();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (message.type === 'log') {
            queueLog(message.data as LogEntry);
          } else if (message.type === 'history') {
            setLogs(message.data as LogEntry[]);
          } else if (message.type === 'alert') {
            const alert = message.data as AlertMessage;
            if (alertEnabled) {
              triggerAlert(alert.message);
              showDesktopNotification(alert);
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
        setConnected(false);
        isConnectingRef.current = false;
        flushBatch();
        scheduleReconnect();
      };

      ws.onerror = (error) => {
        console.error('WebSocket error occurred');
        isConnectingRef.current = false;
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      isConnectingRef.current = false;
      scheduleReconnect();
    }
  }, [flushBatch, queueLog, setLogs, setConnected]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
    }
    reconnectAttemptsRef.current += 1;
    const delay = Math.min(RECONNECT_DELAY * reconnectAttemptsRef.current, 10000);
    console.log(`Scheduling reconnect in ${delay}ms... (Attempt ${reconnectAttemptsRef.current})`);
    reconnectRef.current = window.setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      console.log('Cleaning up WebSocket connection');
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
      flushBatch();
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
    };
  }, [connect, flushBatch]);

  return {
    connected: useLogStore((state) => state.connected),
  };
}
