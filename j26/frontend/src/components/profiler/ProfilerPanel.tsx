import { useState } from 'react';
import { FlameGraph } from './FlameGraph';
import { useProfilerStore } from '@/stores/profilerStore';
import { useEditorStore } from '@/stores/editorStore';
import { BarChart3, Table, Download, Clock, Activity, TrendingUp } from 'lucide-react';
import type { LineProfile, FunctionProfile } from '@/types/debugger';

export function ProfilerPanel() {
  const [activeTab, setActiveTab] = useState<'flamegraph' | 'lines' | 'functions'>('flamegraph');
  const {
    flameGraph,
    lineProfiles,
    functionProfiles,
    totalExecutionTime,
    exportReport,
    isProfiling,
  } = useProfilerStore();
  const { code, fileName } = useEditorStore();

  const hasData = lineProfiles.length > 0 || functionProfiles.length > 0;

  const formatTime = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}`;
    if (ms < 1000) return `${ms.toFixed(2)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  return (
    <div className="h-full flex flex-col bg-debug-panel">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex gap-1">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              activeTab === 'flamegraph' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('flamegraph')}
          >
            <Activity className="w-4 h-4" />
            火焰图
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              activeTab === 'lines' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('lines')}
          >
            <Table className="w-4 h-4" />
            行分析
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
              activeTab === 'functions' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('functions')}
          >
            <BarChart3 className="w-4 h-4" />
            函数分析
          </button>
        </div>

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => exportReport(fileName, code)}
          disabled={!hasData}
        >
          <Download className="w-4 h-4" />
          导出报告
        </button>
      </div>

      {isProfiling && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border-b border-blue-600/30">
          <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
          <span className="text-sm text-blue-300">正在分析性能...</span>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Clock className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg mb-1">暂无性能数据</p>
            <p className="text-sm">运行或调试代码以生成性能分析报告</p>
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-4">
              <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-green-400" />
                <div>
                  <div className="text-2xl font-bold text-white">
                    {formatTime(totalExecutionTime)}
                  </div>
                  <div className="text-xs text-gray-400">总执行时间</div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                <Table className="w-8 h-8 text-blue-400" />
                <div>
                  <div className="text-2xl font-bold text-white">
                    {lineProfiles.length}
                  </div>
                  <div className="text-xs text-gray-400">执行行数</div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                <Activity className="w-8 h-8 text-purple-400" />
                <div>
                  <div className="text-2xl font-bold text-white">
                    {functionProfiles.length}
                  </div>
                  <div className="text-xs text-gray-400">函数调用</div>
                </div>
              </div>
            </div>

            {activeTab === 'flamegraph' && (
              <FlameGraph data={flameGraph} totalTime={totalExecutionTime} />
            )}

            {activeTab === 'lines' && (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-2 text-left text-gray-400 font-medium">行号</th>
                      <th className="px-4 py-2 text-left text-gray-400 font-medium">代码</th>
                      <th className="px-4 py-2 text-right text-gray-400 font-medium">执行次数</th>
                      <th className="px-4 py-2 text-right text-gray-400 font-medium">总时间</th>
                      <th className="px-4 py-2 text-right text-gray-400 font-medium">平均时间</th>
                      <th className="px-4 py-2 text-right text-gray-400 font-medium">最长时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineProfiles
                      .sort((a, b) => b.totalTime - a.totalTime)
                      .map((profile: LineProfile) => (
                      <tr key={profile.lineNumber} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="px-4 py-2 text-gray-300">{profile.lineNumber}</td>
                        <td className="px-4 py-2 text-gray-400 font-mono text-xs truncate max-w-xs" title={profile.code}>
                          {profile.code || '-'}
                        </td>
                        <td className="px-4 py-2 text-right text-white">{profile.hitCount}</td>
                        <td className="px-4 py-2 text-right text-yellow-400">{formatTime(profile.totalTime)}</td>
                        <td className="px-4 py-2 text-right text-gray-300">{formatTime(profile.averageTime)}</td>
                        <td className="px-4 py-2 text-right text-gray-300">{formatTime(profile.maxTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'functions' && (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-2 text-left text-gray-400 font-medium">函数名</th>
                      <th className="px-4 py-2 text-right text-gray-400 font-medium">调用次数</th>
                      <th className="px-4 py-2 text-right text-gray-400 font-medium">总时间</th>
                      <th className="px-4 py-2 text-right text-gray-400 font-medium">平均时间</th>
                      <th className="px-4 py-2 text-right text-gray-400 font-medium">占比</th>
                      <th className="px-4 py-2 text-right text-gray-400 font-medium">行范围</th>
                    </tr>
                  </thead>
                  <tbody>
                    {functionProfiles
                      .sort((a, b) => b.totalTime - a.totalTime)
                      .map((profile: FunctionProfile) => (
                      <tr key={profile.name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="px-4 py-2 text-white font-medium">{profile.name}</td>
                        <td className="px-4 py-2 text-right text-gray-300">{profile.callCount}</td>
                        <td className="px-4 py-2 text-right text-yellow-400">{formatTime(profile.totalTime)}</td>
                        <td className="px-4 py-2 text-right text-gray-300">{formatTime(profile.averageTime)}</td>
                        <td className="px-4 py-2 text-right text-blue-400">
                          {totalExecutionTime > 0 ? ((profile.totalTime / totalExecutionTime) * 100).toFixed(1) : 0}%
                        </td>
                        <td className="px-4 py-2 text-right text-gray-400">
                          {profile.lineRanges[0]}-{profile.lineRanges[1]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
