import axios from 'axios';
import type {
  MultimodalRequest,
  MultimodalResponse,
  VisualFeatures,
  AudioFeatures,
  TextFeatures,
  FusionResult,
  ExplainabilityResult,
  TypingFeatures,
  UserRecord
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthCheck = async (): Promise<{ status: string; timestamp: string; version: string }> => {
  const response = await api.get('/health');
  return response.data;
};

export const analyzeVisual = async (
  sessionId: string,
  videoData: string
): Promise<VisualFeatures> => {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('video_data', videoData);

  const response = await api.post('/analyze/visual', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const analyzeAudio = async (
  sessionId: string,
  audioData: string
): Promise<AudioFeatures> => {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('audio_data', audioData);

  const response = await api.post('/analyze/audio', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const analyzeText = async (
  sessionId: string,
  textData: string
): Promise<TextFeatures> => {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('text_data', textData);

  const response = await api.post('/analyze/text', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const fuseModalities = async (sessionId: string): Promise<FusionResult> => {
  const response = await api.post('/fuse', null, {
    params: { session_id: sessionId },
  });
  return response.data;
};

export const getExplainability = async (sessionId: string): Promise<ExplainabilityResult> => {
  const response = await api.post('/explain', null, {
    params: { session_id: sessionId },
  });
  return response.data;
};

export const fullAnalysis = async (
  request: MultimodalRequest
): Promise<MultimodalResponse> => {
  const response = await api.post('/analyze', request);
  return response.data;
};

export const getUserRecords = async (
  userId: string,
  limit: number = 10
): Promise<{ user_id: string; count: number; records: UserRecord[] }> => {
  const response = await api.get(`/records/${userId}`, {
    params: { limit },
  });
  return response.data;
};

export const getSessionRecord = async (sessionId: string): Promise<UserRecord> => {
  const response = await api.get(`/session/${sessionId}`);
  return response.data;
};

export const clearSession = async (sessionId: string): Promise<{ status: string; message: string }> => {
  const response = await api.delete(`/session/${sessionId}`);
  return response.data;
};

export const getStatistics = async (): Promise<{
  total_records: number;
  severity_distribution: Record<string, number>;
  average_depression_score: number;
  federated_round: number;
  client_id: string;
}> => {
  const response = await api.get('/statistics');
  return response.data;
};

export const federatedTrain = async (): Promise<any> => {
  const response = await api.post('/federated/train');
  return response.data;
};

export const getModelWeights = async (): Promise<any> => {
  const response = await api.get('/federated/weights');
  return response.data;
};

export default api;
