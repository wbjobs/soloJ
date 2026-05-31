import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Trash2, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Shield, Zap } from 'lucide-react';

interface RequestLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
  query: Record<string, any>;
  matchedKeywords: string[];
  dangerLevel: 'low' | 'medium' | 'high' | 'critical';
  dangerScore: number;
}

interface DangerKeyword {
  keyword: string;
  score: number;
  type: string;
}

const RequestLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [keywords, setKeywords] = useState<DangerKeyword[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/logs');
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs);
        setKeywords(data.dangerKeywords);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }, []);

  const clearLogs = async () => {
    try {
      await fetch('http://localhost:3001/api/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    let interval: NodeJS.Timeout;
    if (isAutoRefresh) {
      interval = setInterval(fetchLogs, 2000);
    }
    return () => clearInterval(interval);
  }, [isAutoRefresh, fetchLogs]);

  const getDangerColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-600 text-white';
      case 'medium': return 'bg-yellow-600 text-white';
      default: return 'bg-green-600 text-white';
    }
  };

  const getDangerBorder = (level: string) => {
    switch (level) {
      case 'critical': return 'border-red-500/50 bg-red-900/10';
      case 'high': return 'border-orange-500/50 bg-orange-900/10';
      case 'medium': return 'border-yellow-500/50 bg-yellow-900/10';
      default: return 'border-gray-700';
    }
  };

  const getDangerLabel = (level: string) => {
    switch (level) {
      case 'critical': return '严重';
      case 'high': return '高危';
      case 'medium': return '中危';
      default: return '低危';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false });
  };

  const filteredLogs = filterLevel === 'all'
    ? logs
    : logs.filter(log => log.dangerLevel === filterLevel);

  const stats = {
    total: logs.length,
    critical: logs.filter(l => l.dangerLevel === 'critical').length,
    high: logs.filter(l => l.dangerLevel === 'high').length,
    medium: logs.filter(l => l.dangerLevel === 'medium').length,
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-white">请求流量监控</span>
            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
              {logs.length} 条
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={`p-1.5 rounded transition-colors ${
                isAutoRefresh ? 'text-green-400 bg-green-900/30' : 'text-gray-500 hover:text-gray-300'
              }`}
              title={isAutoRefresh ? '自动刷新中' : '已暂停刷新'}
            >
              <RefreshCw className={`w-4 h-4 ${isAutoRefresh ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
              title="手动刷新"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={clearLogs}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-red-400"
              title="清空日志"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-400">总计:</span>
            <span className="text-white font-bold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-red-400">{stats.critical}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span className="text-orange-400">{stats.high}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span className="text-yellow-400">{stats.medium}</span>
          </div>
          <div className="ml-auto">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-gray-700 text-gray-300 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="all">全部等级</option>
              <option value="critical">严重</option>
              <option value="high">高危</option>
              <option value="medium">中危</option>
              <option value="low">低危</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>暂无请求记录</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`border-l-4 ${getDangerBorder(log.dangerLevel)} transition-all`}
              >
                <div
                  className="px-4 py-3 cursor-pointer hover:bg-gray-800/50"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-xs rounded font-bold ${getDangerColor(log.dangerLevel)}`}>
                        {getDangerLabel(log.dangerLevel)}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        log.method === 'GET' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'
                      }`}>
                        {log.method}
                      </span>
                      <span className="text-white font-mono text-sm">{log.path}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{formatTime(log.timestamp)}</span>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        <span className="text-xs text-yellow-400 font-mono">{log.dangerScore}</span>
                      </div>
                      {expandedId === log.id ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>

                  {log.matchedKeywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {log.matchedKeywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs rounded bg-red-900/50 text-red-300 border border-red-700/50"
                        >
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {expandedId === log.id && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-xs font-medium text-gray-400 mb-1">请求头</h5>
                        <pre className="bg-black p-2 rounded text-xs font-mono text-gray-300 overflow-x-auto max-h-32 overflow-y-auto">
                          {JSON.stringify(log.headers, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-400 mb-1">请求参数</h5>
                        <pre className="bg-black p-2 rounded text-xs font-mono text-gray-300 overflow-x-auto max-h-32 overflow-y-auto">
                          {JSON.stringify(log.query, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-xs font-medium text-gray-400 mb-1">请求体</h5>
                      <pre className="bg-black p-2 rounded text-xs font-mono text-cyan-400 overflow-x-auto max-h-32 overflow-y-auto">
                        {JSON.stringify(log.body, null, 2)}
                      </pre>
                    </div>

                    <div>
                      <h5 className="text-xs font-medium text-gray-400 mb-2">危险评分明细</h5>
                      <div className="bg-black p-3 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                log.dangerScore >= 100 ? 'bg-red-500' :
                                log.dangerScore >= 60 ? 'bg-orange-500' :
                                log.dangerScore >= 30 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(log.dangerScore, 150) / 1.5}%` }}
                            />
                          </div>
                          <span className="text-white font-mono font-bold text-sm">
                            {log.dangerScore} / 150
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {keywords.length > 0 && (
        <div className="px-4 py-3 bg-gray-800 border-t border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-gray-400">关键字检测规则库</span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {keywords.map((kw, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 text-xs rounded bg-gray-700 text-gray-300"
                title={`${kw.type} - ${kw.score} 分`}
              >
                {kw.keyword}
                <span className="text-yellow-400 ml-1">+{kw.score}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestLogViewer;
