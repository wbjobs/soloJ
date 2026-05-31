export interface Task {
  id: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  videoFileName: string;
  videoFileSize: number;
  videoDuration?: number;
  subtitleFileName: string;
  originalSubtitlePath: string;
  alignedSubtitlePath?: string;
  alignmentOffset?: number;
  confidence?: number;
  vadSegments?: VADSegment[];
  subtitleSegments?: SubtitleSegment[];
  errorMessage?: string;
  progress: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface VADSegment {
  start: number;
  end: number;
}

export interface SubtitleSegment {
  index: number;
  start: number;
  end: number;
  text: string;
}

export interface SubtitleCorrection {
  id: string;
  taskId: string;
  subtitleIndex: number;
  originalStart: number;
  originalEnd: number;
  correctedStart: number;
  correctedEnd: number;
  originalText?: string;
  vadStart?: number;
  vadEnd?: number;
  userId?: string;
  isUsedForTraining: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResponse {
  success: boolean;
  taskId: string;
  message: string;
}

export interface TaskListResponse {
  success: boolean;
  tasks: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TaskDetailResponse {
  success: boolean;
  task: Task;
}

export interface WebSocketMessage {
  type: 'progress' | 'completed' | 'error';
  taskId: string;
  progress?: number;
  status?: string;
  message?: string;
  result?: any;
  error?: string;
  timestamp: number;
}

export interface P2PPeer {
  id: string;
  connected: boolean;
  stream?: MediaStream;
}

export interface ModelVersion {
  id: string;
  version: string;
  name: string;
  description?: string;
  modelType: string;
  isActive: boolean;
  isDefault: boolean;
  trainingSampleCount: number;
  validationAccuracy?: number;
  avgOffsetError?: number;
  trainedAt?: string;
  createdAt: string;
}

export interface CalibrationReport {
  id: string;
  taskId: string;
  modelVersion?: string;
  originalOffset?: number;
  correctedOffset?: number;
  confidence?: number;
  vadSegmentCount?: number;
  subtitleSegmentCount?: number;
  matchRateBefore?: number;
  matchRateAfter?: number;
  avgOffsetErrorBefore?: number;
  avgOffsetErrorAfter?: number;
  filePath?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportListResponse {
  success: boolean;
  reports: CalibrationReport[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CorrectionListResponse {
  success: boolean;
  data: SubtitleCorrection[];
}
