import axios from 'axios';
import type { FluidParamsRequest, FluidParamsResponse, ForceDataBatch, ForceDataResponse, VideoUploadResponse } from '@/types/fluid';

const API_BASE_URL = 'http://localhost:8080/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
  transformResponse: [(data: string) => {
    try {
      return JSON.parse(data, (key, value) => {
        if (typeof value === 'number') {
          return value;
        }
        return value;
      });
    } catch {
      return data;
    }
  }],
});

export async function getFluidParams(params?: FluidParamsRequest): Promise<FluidParamsResponse> {
  try {
    const response = await apiClient.get<FluidParamsResponse>('/fluid/params', {
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch fluid params:', error);
    throw error;
  }
}

export async function checkHealth(): Promise<{ status: string; uptime: number }> {
  try {
    const response = await apiClient.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
}

export async function uploadForceData(data: ForceDataBatch): Promise<ForceDataResponse> {
  try {
    const response = await apiClient.post<ForceDataResponse>('/forces', data);
    return response.data;
  } catch (error) {
    console.error('Failed to upload force data:', error);
    throw error;
  }
}

export async function uploadVideo(
  videoBlob: Blob,
  duration: number,
  onProgress?: (progress: number) => void
): Promise<VideoUploadResponse> {
  try {
    const formData = new FormData();
    formData.append('video', videoBlob, 'recording.webm');

    const response = await apiClient.post<VideoUploadResponse>('/video/upload', formData, {
      params: { duration },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = progressEvent.loaded / progressEvent.total;
          onProgress(progress);
        }
      },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to upload video:', error);
    throw error;
  }
}

export function getMockFluidParams(): FluidParamsResponse {
  const gridSize = 32;
  const totalSize = gridSize * gridSize * gridSize;
  
  const densityGrid = new Array(totalSize).fill(1.0);
  const velocityX = new Array(totalSize).fill(0);
  const velocityY = new Array(totalSize).fill(0);
  const velocityZ = new Array(totalSize).fill(0);
  const viscosityField = new Array(totalSize).fill(0.0001);
  
  for (let k = 0; k < gridSize; k++) {
    for (let j = 0; j < gridSize; j++) {
      for (let i = 0; i < gridSize; i++) {
        const idx = k * gridSize * gridSize + j * gridSize + i;
        const x = (i - gridSize / 2) * 0.2;
        const y = (j - gridSize / 2) * 0.2;
        const z = (k - gridSize / 2) * 0.2;
        
        const r = Math.sqrt(x * x + y * y);
        const distFromCenter = Math.sqrt(x * x + y * y + z * z);
        const falloff = 1.0 - Math.min(distFromCenter / 5.0, 1.0);
        
        densityGrid[idx] = 1.0 * (0.8 + 0.4 * Math.sin(x * 0.5) * Math.cos(y * 0.5) * Math.sin(z * 0.3)) * falloff;
        
        const vorticity = 2.0;
        velocityX[idx] = -vorticity * y * Math.exp(-r * r / 8.0) + 0.3 * Math.sin(x + z);
        velocityY[idx] = vorticity * x * Math.exp(-r * r / 8.0) + 0.3 * Math.cos(y + z);
        velocityZ[idx] = 0.2 * Math.sin(x * 0.5 + y * 0.5);
        
        const centerFactor = 1.0 - 0.5 * Math.min(distFromCenter / 6.0, 1.0);
        viscosityField[idx] = 0.0001 * (0.5 + 1.5 * centerFactor);
      }
    }
  }
  
  return {
    success: true,
    data: {
      gridSize,
      viscosity: 0.0001,
      baseDensity: 1.0,
      damping: 0.995,
      timeStep: 0.016,
      densityGrid,
      velocityField: {
        x: velocityX,
        y: velocityY,
        z: velocityZ,
      },
      viscosityField,
      boundaries: {
        min: [-10, -10, -10],
        max: [10, 10, 10],
      },
    },
    timestamp: Date.now(),
  };
}
