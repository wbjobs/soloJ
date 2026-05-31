export interface OutputEvent {
  type: 'stdout' | 'stderr' | 'system';
  data: string;
  timestamp: number;
  room: string;
}

export interface ExecutionStatusEvent {
  type: 'execution_start' | 'execution_end';
  executionId: string;
  room: string;
  exitCode?: number;
}

export interface ExecuteCommandRequest {
  command: string;
  room: string;
}

export interface ExecuteCommandResponse {
  success: boolean;
  message?: string;
  executionId?: string;
}

export interface JoinRoomEvent {
  room: string;
  role: 'host' | 'viewer';
}

export interface Room {
  id: string;
  hostId?: string;
  viewers: string[];
  outputHistory: OutputEvent[];
  isExecuting: boolean;
}

export interface Connection {
  id: string;
  roomId: string;
  role: 'host' | 'viewer';
  socketId: string;
}

export interface RecordedEvent {
  type: 'stdout' | 'stderr' | 'system' | 'command';
  data: string;
  timestamp: number;
  relativeTime: number;
}

export interface RecordingSession {
  sessionId: string;
  room: string;
  startTime: number;
  endTime: number;
  duration: number;
  events: RecordedEvent[];
  commandCount: number;
}

export interface StartRecordingRequest {
  room: string;
}

export interface StartRecordingResponse {
  success: boolean;
  message?: string;
  recording?: boolean;
}

export interface StopRecordingResponse {
  success: boolean;
  message?: string;
  sessionId?: string;
  recording?: boolean;
}

export interface GetRecordingResponse {
  success: boolean;
  message?: string;
  session?: RecordingSession;
}
