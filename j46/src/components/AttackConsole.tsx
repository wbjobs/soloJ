import React, { useState } from 'react';
import { Terminal, Clock, Database, Trash2, ChevronDown, ChevronUp, Copy, CheckCircle, XCircle, Activity } from 'lucide-react';
import { useStore } from '@/store/useStore';
import RequestLogViewer from './RequestLogViewer';

type TabType = 'attack' | 'traffic';

const AttackConsole: React.FC = () => {
  const { attackHistory, currentPayload, currentResponseTime, currentSql, clearHistory } = useStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('attack');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('zh-CN', { hour12: false });
  };

  const highlightSql = (sql: string) => {
    return sql.replace(
      /(SELECT|FROM|WHERE|AND|OR|INSERT|UPDATE|DELETE|UNION|ORDER|GROUP|BY|LIMIT|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|DISTINCT|COUNT|SUM|AVG|MAX|MIN|SLEEP|BENCHMARK|IF|CASE|WHEN|THEN|ELSE|END|DATABASE|USER|VERSION|TABLES|COLUMNS|INFORMATION_SCHEMA)/gi,
      '<span class="text-purple-400 font-bold">$1</span>'
    ).replace(
      /('.*?'|".*?")/g,
      '<span class="text-yellow-300">$1</span>'
    ).replace(
      /(\d+)/g,
      '<span class="text-green-400">$1</span>'
    );
  };

  if (activeTab === 'traffic') {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col h-full">
        <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('attack')}
              className="px-3 py-1.5 text-sm rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center gap-1.5"
            >
              <Terminal className="w-4 h-4" />
              攻击历史
            </button>
            <button
              onClick={() => setActiveTab('traffic')}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white flex items-center gap-1.5"
            >
              <Activity className="w-4 h-4" />
              请求流量
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        {isExpanded && <RequestLogViewer />}
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('attack')}
            className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white flex items-center gap-1.5"
          >
            <Terminal className="w-4 h-4" />
            攻击历史
            <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">
              {attackHistory.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('traffic')}
            className="px-3 py-1.5 text-sm rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors flex items-center gap-1.5"
          >
            <Activity className="w-4 h-4" />
            请求流量
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearHistory();
            }}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-red-400"
            title="清空历史"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="p-4 border-b border-gray-700 bg-gray-850">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
                <Database className="w-4 h-4" />
                <span>当前执行的 SQL</span>
              </div>
              <div className="relative">
                <pre className="bg-black p-3 rounded-md text-sm font-mono overflow-x-auto text-gray-300 min-h-[60px]">
                  {currentSql ? (
                    <code dangerouslySetInnerHTML={{ __html: highlightSql(currentSql) }} />
                  ) : (
                    <span className="text-gray-600">-- 等待执行...</span>
                  )}
                </pre>
                {currentSql && (
                  <button
                    onClick={() => copyToClipboard(currentSql)}
                    className="absolute top-2 right-2 p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
                  <Terminal className="w-4 h-4" />
                  <span>当前 Payload</span>
                </div>
                <div className="bg-black p-3 rounded-md text-sm font-mono text-cyan-400 overflow-x-auto min-h-[40px]">
                  {currentPayload || <span className="text-gray-600">-- 等待输入...</span>}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>响应时间</span>
                </div>
                <div className="bg-black p-3 rounded-md text-sm font-mono">
                  <span className={`font-bold ${currentResponseTime > 1000 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                    {currentResponseTime} ms
                  </span>
                  {currentResponseTime > 1000 && (
                    <span className="text-yellow-400 ml-2 text-xs">可能触发了时间盲注!</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-3">攻击历史</h4>
              {attackHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Terminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>暂无攻击记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attackHistory.map((record) => (
                    <div
                      key={record.id}
                      className={`p-3 rounded-md border ${
                        record.success 
                          ? 'bg-green-900/20 border-green-700' 
                          : 'bg-red-900/20 border-red-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {record.success ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            record.type === 'login' 
                              ? 'bg-blue-900 text-blue-300' 
                              : 'bg-orange-900 text-orange-300'
                          }`}>
                            {record.type === 'login' ? '登录注入' : '搜索注入'}
                          </span>
                          <span className="text-xs text-gray-500">{formatTime(record.timestamp)}</span>
                        </div>
                        <span className={`text-sm font-mono ${
                          record.responseTime > 1000 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {record.responseTime}ms
                        </span>
                      </div>
                      <div className="text-sm font-mono text-cyan-400 mb-1 truncate" title={record.payload}>
                        {record.payload}
                      </div>
                      <div className="text-xs text-gray-400">{record.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AttackConsole;
