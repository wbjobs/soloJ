import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import { getTasks } from '../services/api';
import type { Task } from '../types';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecentTasks();
  }, []);

  const loadRecentTasks = async () => {
    try {
      const response = await getTasks(1, 5);
      setRecentTasks(response.tasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSuccess = (taskId: string) => {
    navigate(`/task/${taskId}`);
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing':
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: Task['status']) => {
    const statusMap = {
      pending: '等待中',
      uploading: '上传中',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
    };
    return statusMap[status];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">字</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">字幕校准系统</h1>
                <p className="text-sm text-gray-500">Subtitle Alignment System</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/tasks')}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <History className="w-5 h-5" />
              <span>历史记录</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            智能音视频字幕校准
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            上传视频和字幕文件，系统将自动检测语音活动并智能校准字幕时间轴，
            让你的字幕与音频完美同步。
          </p>
        </div>

        <FileUpload onUploadSuccess={handleUploadSuccess} />

        {recentTasks.length > 0 && (
          <div className="mt-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              最近任务
            </h3>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">视频文件</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">偏移量</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTasks.map((task) => (
                    <tr
                      key={task.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/task/${task.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {task.videoFileName}
                        </div>
                        <div className="text-xs text-gray-500">{task.subtitleFileName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(task.status)}
                          <span className="text-sm text-gray-700">{getStatusText(task.status)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {task.alignmentOffset !== undefined ? (
                          <span className="text-sm text-gray-700">
                            {task.alignmentOffset > 0 ? '+' : ''}{task.alignmentOffset.toFixed(2)}s
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(task.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 py-6 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>音视频字幕校准系统 · 基于 VAD 语音活动检测的智能对齐算法</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
