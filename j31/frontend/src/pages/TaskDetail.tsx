import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Zap,
  Minus,
  Plus,
} from 'lucide-react';
import VideoPreview from '../components/VideoPreview';
import DraggableTimeline from '../components/DraggableTimeline';
import ReportPanel from '../components/ReportPanel';
import CorrectionList from '../components/CorrectionList';
import {
  getTask,
  downloadSubtitle,
  applyOffset,
  deleteTask,
  createSubtitleCorrection,
  getTaskCorrections,
} from '../services/api';
import websocketService from '../services/websocket';
import type { Task, WebSocketMessage, SubtitleSegment, VADSegment, SubtitleCorrection } from '../types';

const TaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [manualOffset, setManualOffset] = useState(0);
  const [isApplyingOffset, setIsApplyingOffset] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [corrections, setCorrections] = useState<SubtitleCorrection[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'corrections' | 'reports'>('timeline');

  useEffect(() => {
    if (taskId) {
      loadTask();
      websocketService.connect();
      websocketService.subscribe(taskId);

      const handleProgress = (message: WebSocketMessage) => {
        if (message.taskId === taskId) {
          setTask((prev) =>
            prev
              ? {
                  ...prev,
                  status: message.status as Task['status'],
                  progress: message.progress || 0,
                }
              : null
          );
        }
      };

      const handleCompleted = (message: WebSocketMessage) => {
        if (message.taskId === taskId) {
          loadTask();
        }
      };

      const handleError = (message: WebSocketMessage) => {
        if (message.taskId === taskId) {
          setError(message.error || '处理失败');
          loadTask();
        }
      };

      websocketService.on('progress', handleProgress);
      websocketService.on('completed', handleCompleted);
      websocketService.on('error', handleError);

      return () => {
        websocketService.off('progress', handleProgress);
        websocketService.off('completed', handleCompleted);
        websocketService.off('error', handleError);
      };
    }
  }, [taskId]);

  useEffect(() => {
    if (task?.alignmentOffset !== undefined) {
      setManualOffset(task.alignmentOffset);
    }
  }, [task]);

  const loadTask = async () => {
    if (!taskId) return;

    try {
      const [taskResponse, correctionsResponse] = await Promise.all([
        getTask(taskId),
        getTaskCorrections(taskId).catch(() => ({ success: true, data: [] })),
      ]);
      
      setTask(taskResponse.task);
      if (correctionsResponse.success && correctionsResponse.data) {
        setCorrections(correctionsResponse.data);
      }
      if (taskResponse.task.metadata?.videoPath) {
        setVideoUrl(`/uploads/${taskResponse.task.metadata.videoPath.split('/').pop()}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '加载任务失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSegmentDragEnd = async (index: number, newStart: number, newEnd: number) => {
    if (!taskId || !task?.subtitleSegments) return;

    const originalSegment = task.subtitleSegments.find((s) => s.index === index);
    if (!originalSegment) return;

    try {
      const response = await createSubtitleCorrection(taskId, {
        subtitleIndex: index,
        originalStart: originalSegment.start,
        originalEnd: originalSegment.end,
        correctedStart: newStart,
        correctedEnd: newEnd,
        originalText: originalSegment.text,
      });

      if (response.success) {
        setCorrections((prev) => [...prev, response.data]);
        const newSegments = task.subtitleSegments.map((s) =>
          s.index === index ? { ...s, start: newStart, end: newEnd } : s
        );
        setTask((prev) => (prev ? { ...prev, subtitleSegments: newSegments } : null));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '保存修正失败');
    }
  };

  const handleCorrectionDeleted = (correctionId: string) => {
    setCorrections((prev) => prev.filter((c) => c.id !== correctionId));
  };

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleApplyOffset = async () => {
    if (!taskId) return;

    setIsApplyingOffset(true);
    try {
      await applyOffset(taskId, manualOffset);
      await loadTask();
    } catch (err: any) {
      setError(err.response?.data?.error || '应用偏移量失败');
    } finally {
      setIsApplyingOffset(false);
    }
  };

  const handleResetOffset = () => {
    if (task?.alignmentOffset !== undefined) {
      setManualOffset(task.alignmentOffset);
    }
  };

  const handleDelete = async () => {
    if (!taskId || !window.confirm('确定要删除此任务吗？')) return;

    try {
      await deleteTask(taskId);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败');
    }
  };

  const getStatusInfo = (status: Task['status']) => {
    const statusMap = {
      pending: { text: '等待中', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
      uploading: { text: '上传中', color: 'text-blue-600', bg: 'bg-blue-100', icon: Loader2 },
      processing: { text: '处理中', color: 'text-blue-600', bg: 'bg-blue-100', icon: Loader2 },
      completed: { text: '已完成', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
      failed: { text: '失败', color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
    };
    return statusMap[status];
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">任务不存在</p>
          <button
            onClick={() => navigate('/')}
            className="text-primary-600 hover:text-primary-700"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(task.status);
  const StatusIcon = statusInfo.icon;
  const duration = task.subtitleSegments?.length
    ? Math.max(...task.subtitleSegments.map((s) => s.end))
    : 600;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{task.videoFileName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm ${statusInfo.bg} ${statusInfo.color}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${task.status === 'processing' ? 'animate-spin' : ''}`} />
                    {statusInfo.text}
                  </span>
                  <span className="text-sm text-gray-500">{task.subtitleFileName}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {task.status === 'completed' && (
                <button
                  onClick={() => downloadSubtitle(task.id, 'aligned')}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载校准字幕
                </button>
              )}
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              ×
            </button>
          </div>
        </div>
      )}

      {(task.status === 'processing' || task.status === 'uploading') && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              <div>
                <h3 className="font-medium text-gray-900">正在处理...</h3>
                <p className="text-sm text-gray-500">
                  {task.status === 'uploading' ? '文件上传中' : '正在分析音频和校准字幕'}
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">{task.progress}%</p>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {videoUrl && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-medium text-gray-900">视频预览</h3>
                </div>
                <VideoPreview
                  videoUrl={videoUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onSeek={handleSeek}
                />
              </div>
            )}

            {task.vadSegments && task.subtitleSegments && (
              <div className="bg-white rounded-xl shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-medium text-gray-900 mb-3">时间轴</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'timeline'
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    时间轴对比
                  </button>
                  <button
                    onClick={() => setActiveTab('corrections')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'corrections'
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    字幕修正 {corrections.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-xs rounded-full">
                        {corrections.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('reports')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'reports'
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    校准报告
                  </button>
                </div>
              </div>
              
              <div className="p-4">
                {activeTab === 'timeline' && (
                  <>
                    <p className="text-sm text-gray-500 mb-4">
                      绿色为语音活动(VAD)，蓝色为字幕时间轴。拖拽字幕段边缘可调整时间，橙色段为已修正
                    </p>
                    <DraggableTimeline
                      vadSegments={task.vadSegments}
                      subtitleSegments={task.subtitleSegments}
                      duration={duration}
                      onSeek={handleSeek}
                      currentTime={currentTime}
                      onSegmentDragEnd={handleSegmentDragEnd}
                      corrections={corrections}
                      editable={task.status === 'completed'}
                    />
                  </>
                )}
                
                {activeTab === 'corrections' && (
                  <CorrectionList
                    taskId={taskId!}
                    onCorrectionDeleted={handleCorrectionDeleted}
                  />
                )}
                
                {activeTab === 'reports' && taskId && task && (
                  <ReportPanel taskId={taskId} task={task} />
                )}
              </div>
            </div>
          )}
          </div>

          <div className="space-y-6">
            {task.status === 'completed' && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  校准结果
                </h3>

                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">计算偏移量</div>
                    <div className="text-3xl font-bold text-gray-900">
                      {task.alignmentOffset! > 0 ? '+' : ''}{task.alignmentOffset?.toFixed(3)}s
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      置信度: {(task.confidence! * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      手动调整偏移量
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setManualOffset((v) => Math.round((v - 0.1) * 100) / 100)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        step="0.1"
                        value={manualOffset}
                        onChange={(e) => setManualOffset(parseFloat(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center"
                      />
                      <button
                        onClick={() => setManualOffset((v) => Math.round((v + 0.1) * 100) / 100)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleResetOffset}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      重置
                    </button>
                    <button
                      onClick={handleApplyOffset}
                      disabled={isApplyingOffset || manualOffset === task.alignmentOffset}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isApplyingOffset ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      应用
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-medium text-gray-900 mb-4">任务信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">视频文件</span>
                  <span className="text-gray-900 truncate ml-4 max-w-40" title={task.videoFileName}>
                    {task.videoFileName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">字幕文件</span>
                  <span className="text-gray-900 truncate ml-4 max-w-40" title={task.subtitleFileName}>
                    {task.subtitleFileName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">创建时间</span>
                  <span className="text-gray-900">
                    {new Date(task.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                {task.vadSegments && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">语音段数</span>
                    <span className="text-gray-900">{task.vadSegments.length}</span>
                  </div>
                )}
                {task.subtitleSegments && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">字幕条数</span>
                    <span className="text-gray-900">{task.subtitleSegments.length}</span>
                  </div>
                )}
              </div>
            </div>

            {task.subtitleSegments && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-medium text-gray-900 mb-4">字幕列表</h3>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {task.subtitleSegments.slice(0, 30).map((seg) => (
                    <div
                      key={seg.index}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => handleSeek(seg.start)}
                    >
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <span className="font-mono">#{seg.index}</span>
                        <span>{formatTime(seg.start)} → {formatTime(seg.end)}</span>
                      </div>
                      <div className="text-sm text-gray-800 line-clamp-2">{seg.text}</div>
                    </div>
                  ))}
                  {task.subtitleSegments.length > 30 && (
                    <div className="text-center text-sm text-gray-500 py-2">
                      还有 {task.subtitleSegments.length - 30} 条字幕...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TaskDetail;
