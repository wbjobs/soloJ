import axios from 'axios';
import type {
  TopologyData,
  ServiceNode,
  Span,
  ErrorLog,
  ApiResponse,
} from '../../shared/types';

const api = axios.create({
  baseURL: 'http://localhost:3001/api/v1',
  timeout: 15000,
});

async function request<T>(promise: Promise<{ data: T }>): Promise<ApiResponse<T>> {
  try {
    const response = await promise;
    return { success: true, data: response.data };
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return { success: false, error: '请求超时，服务端可能正在处理大量数据，请稍后重试' };
    }
    if (error.response?.status === 504) {
      return { success: false, error: error.response.data?.error || '拓扑查询超时，请尝试减小深度限制' };
    }
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
}

export function getTopology(maxDepth?: number): Promise<ApiResponse<TopologyData>> {
  const params: Record<string, any> = {};
  if (maxDepth) params.maxDepth = maxDepth;
  return request(api.get<TopologyData>('/topology', { params }));
}

export function getServices(): Promise<ApiResponse<ServiceNode[]>> {
  return request(api.get<ServiceNode[]>('/services'));
}

export function getServiceSpans(
  serviceId: string,
  limit?: number,
  offset?: number,
): Promise<ApiResponse<Span[]>> {
  return request(
    api.get<Span[]>(`/services/${serviceId}/spans`, { params: { limit, offset } }),
  );
}

export function getSpanById(spanId: string): Promise<ApiResponse<Span>> {
  return request(api.get<Span>(`/spans/${spanId}`));
}

export function getTraceById(traceId: string): Promise<ApiResponse<Span[]>> {
  return request(api.get<Span[]>(`/traces/${traceId}`));
}

export function getServiceErrors(
  serviceId: string,
  limit?: number,
  offset?: number,
): Promise<ApiResponse<ErrorLog[]>> {
  return request(
    api.get<ErrorLog[]>(`/services/${serviceId}/errors`, { params: { limit, offset } }),
  );
}

export function getErrorById(errorId: string): Promise<ApiResponse<ErrorLog>> {
  return request(api.get<ErrorLog>(`/errors/${errorId}`));
}

export function generateMockData(config?: {
  serviceCount?: number;
  traceCount?: number;
  errorRate?: number;
  maxDepth?: number;
}): Promise<ApiResponse<void>> {
  return request(api.post<void>('/mock/generate', config));
}

export function clearMockData(): Promise<ApiResponse<void>> {
  return request(api.post<void>('/mock/clear'));
}
