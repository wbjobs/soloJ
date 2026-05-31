export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: number;
  serviceName: string;
  level: LogLevel;
  message: string;
}

export interface AlertMessage {
  id: string;
  timestamp: number;
  type: 'error_spike';
  title: string;
  message: string;
  errorCount: number;
  windowSeconds: number;
}

export interface WebSocketMessage {
  type: 'log' | 'history' | 'status' | 'alert';
  data: LogEntry | LogEntry[] | AlertMessage | { connected: boolean; count: number };
}

export const SERVICES = ['user-service', 'order-service', 'payment-service'] as const;
export const LOG_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
