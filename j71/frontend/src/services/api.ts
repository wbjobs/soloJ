import axios from 'axios';
import type { AuditLogRequest, AuditLogResponse, HourlyStats } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const submitAuditLog = async (
  metadata: AuditLogRequest
): Promise<AuditLogResponse> => {
  try {
    const response = await api.post<AuditLogResponse>('/api/audit', metadata);
    return response.data;
  } catch (error) {
    console.error('Failed to submit audit log:', error);
    throw error;
  }
};

export const submitBatchAuditLogs = async (
  metadataList: AuditLogRequest[]
): Promise<AuditLogResponse[]> => {
  const results: AuditLogResponse[] = [];
  for (const metadata of metadataList) {
    try {
      const response = await api.post<AuditLogResponse>('/api/audit', metadata);
      results.push(response.data);
    } catch (error) {
      console.error('Failed to submit audit log for batch:', error);
    }
  }
  return results;
};

export const getAuditLogs = async (
  page: number = 1,
  limit: number = 20
): Promise<{ logs: AuditLogResponse[]; total: number; page: number; limit: number }> => {
  try {
    const response = await api.get('/api/audit', {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    throw error;
  }
};

export const getAuditLogById = async (id: number): Promise<AuditLogResponse> => {
  try {
    const response = await api.get(`/api/audit/${id}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch audit log:', error);
    throw error;
  }
};

export const getAuditStats = async (
  hours: number = 24
): Promise<HourlyStats> => {
  try {
    const response = await api.get('/api/audit/stats', {
      params: { hours },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch audit stats:', error);
    throw error;
  }
};

export default api;
