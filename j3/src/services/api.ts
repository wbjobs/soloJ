import type {
  ExecuteCommandRequest,
  ExecuteCommandResponse,
  StartRecordingResponse,
  StopRecordingResponse,
  GetRecordingResponse,
  RecordingSession,
} from '../../shared/types';

const API_BASE_URL = 'http://localhost:3001/api';

export async function executeCommand(
  command: string,
  room: string
): Promise<ExecuteCommandResponse> {
  const response = await fetch(`${API_BASE_URL}/command/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command, room } as ExecuteCommandRequest),
  });

  const data = (await response.json()) as ExecuteCommandResponse;

  if (!response.ok) {
    throw new Error(data.message || '请求失败');
  }

  return data;
}

export async function stopCommand(room: string): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/command/stop/${encodeURIComponent(room)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = (await response.json()) as { success: boolean; message?: string };

  if (!response.ok) {
    throw new Error(data.message || '停止失败');
  }

  return data;
}

export async function startRecording(room: string): Promise<StartRecordingResponse> {
  const response = await fetch(`${API_BASE_URL}/command/recording/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ room }),
  });

  const data = (await response.json()) as StartRecordingResponse;

  if (!response.ok) {
    throw new Error(data.message || '开始录制失败');
  }

  return data;
}

export async function stopRecording(room: string): Promise<StopRecordingResponse> {
  const response = await fetch(`${API_BASE_URL}/command/recording/stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ room }),
  });

  const data = (await response.json()) as StopRecordingResponse;

  if (!response.ok) {
    throw new Error(data.message || '停止录制失败');
  }

  return data;
}

export async function getRecordingStatus(
  room: string
): Promise<{ recording: boolean; duration?: number; eventCount?: number; commandCount?: number }> {
  const response = await fetch(`${API_BASE_URL}/command/recording/status/${encodeURIComponent(room)}`);
  const data = (await response.json()) as {
    success: boolean;
    recording: boolean;
    duration?: number;
    eventCount?: number;
    commandCount?: number;
  };

  if (!response.ok) {
    throw new Error('获取录制状态失败');
  }

  return data;
}

export async function getRecording(sessionId: string): Promise<RecordingSession> {
  const response = await fetch(`${API_BASE_URL}/command/recording/${encodeURIComponent(sessionId)}`);
  const data = (await response.json()) as GetRecordingResponse;

  if (!response.ok || !data.session) {
    throw new Error(data.message || '获取录制失败');
  }

  return data.session;
}

export async function getAllRecordings(): Promise<RecordingSession[]> {
  const response = await fetch(`${API_BASE_URL}/command/recordings`);
  const data = (await response.json()) as { success: boolean; data: RecordingSession[] };

  if (!response.ok) {
    throw new Error('获取录制列表失败');
  }

  return data.data;
}
