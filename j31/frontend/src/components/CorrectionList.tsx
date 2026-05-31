import React, { useState, useEffect } from 'react';
import {
  Edit3,
  Trash2,
  AlertCircle,
  FileText,
  Clock,
  Loader2,
} from 'lucide-react';
import type { SubtitleCorrection } from '../types';
import { getTaskCorrections, deleteSubtitleCorrection } from '../services/api';

interface CorrectionListProps {
  taskId: string;
}

const CorrectionList: React.FC<CorrectionListProps> = ({ taskId }) => {
  const [corrections, setCorrections] = useState<SubtitleCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCorrections();
  }, [taskId]);

  const loadCorrections = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getTaskCorrections(taskId);
      if (response.success) {
        setCorrections(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '加载修正记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这条修正记录吗？')) return;

    setDeletingId(id);
    setError(null);

    try {
      const response = await deleteSubtitleCorrection(id);
      if (response.success) {
        setCorrections((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '删除失败，请重试');
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const formatTimeDiff = (original: number, corrected: number): string => {
    const diff = corrected - original;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(3)}s`;
  };

  const getTimeDiffColor = (diff: number): string => {
    const absDiff = Math.abs(diff);
    if (absDiff < 0.1) return 'text-green-400';
    if (absDiff < 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="w-full bg-gray-900 rounded-lg p-6 text-white">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400 mr-3" />
          <span className="text-gray-400">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-900 rounded-lg p-6 text-white">
      <div className="flex items-center gap-3 mb-6">
        <Edit3 className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-semibold">字幕修正记录</h3>
        <span className="px-2 py-0.5 bg-gray-700 rounded text-sm text-gray-300">
          {corrections.length} 条
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-900/50 text-red-400 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {corrections.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无修正记录</p>
            <p className="text-sm mt-1">手动调整字幕后会显示在这里</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    字幕序号
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    原时间
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    修正后时间
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                    时间差
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {corrections.map((correction) => {
                  const timeDiff = correction.correctedStart - correction.originalStart;
                  return (
                    <tr
                      key={correction.id}
                      className="hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-sm font-mono">
                          #{correction.subtitleIndex}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="font-mono text-gray-300">
                            {formatTime(correction.originalStart)} → {formatTime(correction.originalEnd)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-blue-400" />
                          <span className="font-mono text-blue-300">
                            {formatTime(correction.correctedStart)} → {formatTime(correction.correctedEnd)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-sm ${getTimeDiffColor(timeDiff)}`}>
                          {formatTimeDiff(correction.originalStart, correction.correctedStart)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(correction.id)}
                          disabled={deletingId === correction.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                        >
                          {deletingId === correction.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CorrectionList;
