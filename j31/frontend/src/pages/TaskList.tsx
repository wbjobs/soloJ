import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Trash2,
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getTasks, deleteTask, downloadSubtitle } from '../services/api';
import type { Task } from '../types';

const TaskList: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    loadTasks();
  }, [currentPage, statusFilter]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const response = await getTasks(currentPage, 10, statusFilter || undefined);
      setTasks(response.tasks);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('确定要删除此任务吗？')) return;

    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const getStatusInfo = (status: Task['status']) => {
    const statusMap = {
      pending: { text: '等待中', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
      uploading: { text: '上传中', color: 'text-blue-600', bg: 'bg-blue-100', icon: Loader2 },
      processing: { text: '处理中', color: 'text-blue-600', bg: 'bg-blue-100', icon: Loader2 },
      completed: { text: '已完成', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
      failed: { text: '失败', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
    };
    return statusMap[status];
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
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
                <h1 className="text-xl font-bold text-gray-900">任务列表</h1>
                <p className="text-sm text-gray-500">所有校准任务记录</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">全部状态</option>
                  <option value="pending">等待中</option>
                  <option value="processing">处理中</option>
                  <option value="completed">已完成</option>
                  <option value="failed">失败</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无任务记录</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-primary-600 hover:text-primary-700"
            >
              创建新任务
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">视频文件</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">字幕文件</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">大小</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">偏移量</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">创建时间</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasks.map((task) => {
                    const statusInfo = getStatusInfo(task.status);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div
                            className="text-sm font-medium text-gray-900 truncate max-w-xs cursor-pointer hover:text-primary-600"
                            onClick={() => navigate(`/task/${task.id}`)}
                          >
                            {task.videoFileName}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600 truncate max-w-xs">
                            {task.subtitleFileName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatFileSize(task.videoFileSize)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs ${statusInfo.bg} ${statusInfo.color}`}
                          >
                            <StatusIcon
                              className={`w-3 h-3 ${task.status === 'processing' ? 'animate-spin' : ''}`}
                            />
                            {statusInfo.text}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {task.alignmentOffset !== undefined ? (
                            <span>
                              {task.alignmentOffset > 0 ? '+' : ''}
                              {task.alignmentOffset.toFixed(2)}s
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(task.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/task/${task.id}`)}
                              className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                              title="查看"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {task.status === 'completed' && (
                              <button
                                onClick={() => downloadSubtitle(task.id, 'aligned')}
                                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="下载字幕"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(task.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default TaskList;
