import axios, { AxiosError, type AxiosResponse } from 'axios';
import type { ApiResponse, SensorData } from '@/types';

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 300;
const MAX_RETRY_DELAY = 2000;

function isRetryableError(error: AxiosError): boolean {
  if (!error.response) {
    return true;
  }
  const status = error.response.status;
  return status >= 500 || status === 429 || status === 408;
}

function shouldRetryForStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}

function calculateRetryDelay(attempt: number): number {
  const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
  return Math.min(delay, MAX_RETRY_DELAY);
}

async function requestWithRetry<T>(
  requestFn: () => Promise<AxiosResponse<T>>,
  retries: number = MAX_RETRIES
): Promise<AxiosResponse<T>> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    try {
      const response = await requestFn();
      
      if (response.status >= 200 && response.status < 300) {
        return response;
      }

      if (!shouldRetryForStatus(response.status) || attempt >= retries) {
        return response;
      }

      throw new AxiosError(
        `Request failed with status ${response.status}`,
        `ERR_BAD_RESPONSE`,
        undefined,
        undefined,
        response
      );
    } catch (error) {
      lastError = error as Error;
      
      if (attempt >= retries) {
        break;
      }

      const axiosError = error as AxiosError;
      if (!isRetryableError(axiosError)) {
        throw error;
      }

      const delay = calculateRetryDelay(attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }

  throw lastError;
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 400) {
      console.warn('Request failed with 400, will not retry:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export async function getWorkshops(): Promise<string[]> {
  const response = await requestWithRetry(() =>
    apiClient.get<ApiResponse<{ workshops: string[] }>>('/api/sensor/workshops')
  );
  return response.data.data.workshops;
}

export async function getLatestData(): Promise<Record<string, Record<string, SensorData>>> {
  const response = await requestWithRetry(() =>
    apiClient.get<ApiResponse<Record<string, Record<string, SensorData>>>>('/api/sensor/latest')
  );
  return response.data.data;
}

export async function getHistoryData(
  workshop: string,
  sensorId: string,
  hours: number = 1
): Promise<SensorData[]> {
  const response = await requestWithRetry(() =>
    apiClient.get<ApiResponse<{ data: SensorData[] }>>(
      `/api/sensor/history?workshop=${encodeURIComponent(workshop)}&sensorId=${encodeURIComponent(sensorId)}&hours=${hours}`
    )
  );
  return response.data.data.data;
}

export async function postSensorData(data: SensorData): Promise<void> {
  await requestWithRetry(() => apiClient.post('/api/sensor/data', data));
}

export async function postSensorDataBatch(data: SensorData[]): Promise<void> {
  await requestWithRetry(() => apiClient.post('/api/sensor/data/batch', { data }), 1);
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await apiClient.get('/api/health');
    return response.status === 200;
  } catch {
    return false;
  }
}

export default apiClient;
