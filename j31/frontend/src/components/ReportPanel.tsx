import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Target,
  TrendingUp,
  Plus,
} from 'lucide-react';
import type { Task, CalibrationReport } from '../types';
import { generateReport, getTaskReports, downloadReport } from '../services/api';

interface ReportPanelProps {
  taskId: string;
  task: Task;
}

const ReportPanel: React.FC<ReportPanelProps> = ({ taskId, task }) => {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<CalibrationReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [taskId]);

  const loadReports = async () => {
    try {
      const response = await getTaskReports(taskId);
      if (response.success) {
        setReports(response.reports);
      }
    } catch (err: any) {
      console.error('Load reports error:', err);
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await generateReport(taskId);
      if (response.success) {
        setSuccess('报告生成成功！');
        await loadReports();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '生成报告失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (report: CalibrationReport) => {
    try {
      await downloadReport(report.id);
    } catch (err: any) {
      setError(err.response?.data?.error || '下载失败，请重试');
    }
  };

  const formatTime = (seconds: number | undefined): string => {
    if (seconds === undefined) return '-';
    const sign = seconds >= 0 ? '+' : '';
    return `${sign}${seconds.toFixed(3)}s`;
  };

  const formatPercent = (value: number | undefined): string => {
    if (value === undefined) return '-';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatDateTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getReportName = (_report: CalibrationReport, index: number): string => {
    const baseName = task.videoFileName.replace(/\.[^/.]+$/, '');
    return `校准报告_${baseName}_${index + 1}`;
  };

  return (
    <div className="w-full bg-gray-900 rounded-lg p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold">校准报告</h3>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={loading || task.status !== 'completed'}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              生成PDF报告
            </>
          )}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-green-900/50 text-green-400 rounded-lg">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-900/50 text-red-400 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Clock className="w-4 h-4" />
            <span>偏移量</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatTime(task.alignmentOffset)}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Target className="w-4 h-4" />
            <span>置信度</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatPercent(task.confidence)}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <TrendingUp className="w-4 h-4" />
            <span>匹配率</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {reports.length > 0 && reports[0].matchRateAfter !== undefined
              ? formatPercent(reports[0].matchRateAfter)
              : task.confidence !== undefined
              ? formatPercent(task.confidence)
              : '-'}
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h4 className="font-medium">历史报告</h4>
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无报告记录</p>
            <p className="text-sm mt-1">点击上方按钮生成校准报告</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                  报告名称
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                  生成时间
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">
                  匹配率
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {reports.map((report, index) => (
                <tr key={report.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="text-sm">{getReportName(report, index)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatDateTime(report.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-green-400">
                      {formatPercent(report.matchRateAfter)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDownloadReport(report)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      下载
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ReportPanel;
