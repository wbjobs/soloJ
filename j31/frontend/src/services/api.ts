import axios from 'axios';
import type {
  UploadResponse,
  TaskListResponse,
  TaskDetailResponse,
  CalibrationReport,
  SubtitleCorrection,
  ReportListResponse,
  CorrectionListResponse,
  ModelVersion,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 300000,
});

export const uploadFiles = async (
  videoFile: File,
  subtitleFile: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('video', videoFile);
  formData.append('subtitle', subtitleFile);

  const response = await api.post<UploadResponse>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(progress);
      }
    },
  });

  return response.data;
};

export const uploadChunk = async (
  taskId: string,
  chunk: Blob,
  chunkIndex: number,
  totalChunks: number,
  fileName: string,
  fileSize: number
): Promise<{ success: boolean; chunkIndex: number; received: boolean }> => {
  const formData = new FormData();
  formData.append('chunk', chunk);
  formData.append('chunkIndex', chunkIndex.toString());
  formData.append('totalChunks', totalChunks.toString());
  formData.append('fileName', fileName);
  formData.append('fileSize', fileSize.toString());
  formData.append('taskId', taskId);

  const response = await api.post('/upload/chunk', formData);
  return response.data;
};

export const mergeChunks = async (
  taskId: string,
  fileName: string,
  totalChunks: number,
  isVideo: boolean
): Promise<{ success: boolean; filePath: string }> => {
  const response = await api.post('/upload/merge', {
    taskId,
    fileName,
    totalChunks,
    isVideo,
  });
  return response.data;
};

export const getTasks = async (
  page: number = 1,
  limit: number = 10,
  status?: string
): Promise<TaskListResponse> => {
  const params: Record<string, any> = { page, limit };
  if (status) params.status = status;

  const response = await api.get<TaskListResponse>('/tasks', { params });
  return response.data;
};

export const getTask = async (taskId: string): Promise<TaskDetailResponse> => {
  const response = await api.get<TaskDetailResponse>(`/tasks/${taskId}`);
  return response.data;
};

export const deleteTask = async (taskId: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/tasks/${taskId}`);
  return response.data;
};

export const applyOffset = async (
  taskId: string,
  offset: number
): Promise<{ success: boolean; message: string; offset: number }> => {
  const response = await api.post(`/tasks/${taskId}/apply-offset`, { offset });
  return response.data;
};

export const downloadSubtitle = async (taskId: string, type: 'aligned' | 'original' = 'aligned') => {
  const response = await api.get(`/tasks/${taskId}/download`, {
    params: { type },
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/x-subrip' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = type === 'aligned' ? 'aligned_subtitle.srt' : 'original_subtitle.srt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const createSubtitleCorrection = async (
  taskId: string,
  correction: Partial<SubtitleCorrection>
): Promise<{ success: boolean; data: SubtitleCorrection; message: string }> => {
  const response = await api.post(`/tasks/${taskId}/corrections`, correction);
  return response.data;
};

export const getTaskCorrections = async (
  taskId: string
): Promise<CorrectionListResponse> => {
  const response = await api.get<CorrectionListResponse>(`/tasks/${taskId}/corrections`);
  return response.data;
};

export const updateSubtitleCorrection = async (
  id: string,
  correction: Partial<SubtitleCorrection>
): Promise<{ success: boolean; data: SubtitleCorrection; message: string }> => {
  const response = await api.put(`/corrections/${id}`, correction);
  return response.data;
};

export const deleteSubtitleCorrection = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/corrections/${id}`);
  return response.data;
};

export const generateReport = async (
  taskId: string
): Promise<{ success: boolean; message: string; report: CalibrationReport }> => {
  const response = await api.post(`/tasks/${taskId}/reports`, { userId: 'anonymous' });
  return response.data;
};

export const getTaskReports = async (
  taskId: string
): Promise<ReportListResponse> => {
  const response = await api.get<ReportListResponse>(`/tasks/${taskId}/reports`);
  return response.data;
};

export const downloadReport = async (id: string): Promise<void> => {
  const response = await api.get(`/reports/${id}/download`, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report_${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const getModels = async (): Promise<ModelVersion[]> => {
  const response = await api.get<ModelVersion[]>('/models');
  return response.data;
};

export const getDefaultModel = async (): Promise<ModelVersion> => {
  const response = await api.get<ModelVersion>('/models/default');
  return response.data;
};

export default api;
