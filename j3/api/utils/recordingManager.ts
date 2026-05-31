import type { OutputEvent, RecordedEvent, RecordingSession } from '../../shared/types.js';

interface ActiveRecording {
  room: string;
  startTime: number;
  events: RecordedEvent[];
  commandCount: number;
  lastCommand: string;
}

const activeRecordings = new Map<string, ActiveRecording>();
const savedRecordings = new Map<string, RecordingSession>();

function generateSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function startRecording(room: string): { success: boolean; message?: string } {
  if (activeRecordings.has(room)) {
    return { success: false, message: '该房间已有正在进行的录制' };
  }

  activeRecordings.set(room, {
    room,
    startTime: Date.now(),
    events: [],
    commandCount: 0,
    lastCommand: '',
  });

  return { success: true, message: '录制已开始' };
}

export function stopRecording(room: string): {
  success: boolean;
  message?: string;
  sessionId?: string;
} {
  const recording = activeRecordings.get(room);
  if (!recording) {
    return { success: false, message: '该房间没有正在进行的录制' };
  }

  const endTime = Date.now();
  const sessionId = generateSessionId();

  const session: RecordingSession = {
    sessionId,
    room: recording.room,
    startTime: recording.startTime,
    endTime,
    duration: endTime - recording.startTime,
    events: recording.events,
    commandCount: recording.commandCount,
  };

  savedRecordings.set(sessionId, session);
  activeRecordings.delete(room);

  return { success: true, sessionId, message: '录制已完成' };
}

export function recordEvent(room: string, event: OutputEvent, isCommand: boolean = false): void {
  const recording = activeRecordings.get(room);
  if (!recording) return;

  if (isCommand && event.data !== recording.lastCommand) {
    recording.commandCount++;
    recording.lastCommand = event.data;
  }

  const recordedEvent: RecordedEvent = {
    type: isCommand ? 'command' : event.type,
    data: event.data,
    timestamp: event.timestamp,
    relativeTime: event.timestamp - recording.startTime,
  };

  recording.events.push(recordedEvent);
}

export function getRecording(sessionId: string): RecordingSession | undefined {
  return savedRecordings.get(sessionId);
}

export function isRecording(room: string): boolean {
  return activeRecordings.has(room);
}

export function getRecordingStatus(room: string): {
  recording: boolean;
  duration?: number;
  eventCount?: number;
  commandCount?: number;
} {
  const recording = activeRecordings.get(room);
  if (!recording) {
    return { recording: false };
  }
  return {
    recording: true,
    duration: Date.now() - recording.startTime,
    eventCount: recording.events.length,
    commandCount: recording.commandCount,
  };
}

export function getAllRecordings(): RecordingSession[] {
  return Array.from(savedRecordings.values());
}

export function deleteRecording(sessionId: string): boolean {
  return savedRecordings.delete(sessionId);
}
