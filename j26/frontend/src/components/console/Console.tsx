import { useRef, useEffect } from 'react';
import { Terminal, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useConsoleStore } from '@/stores/consoleStore';

export function Console() {
  const { outputs, isVisible, isLoading, clearOutputs, toggleVisible } = useConsoleStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [outputs]);

  const getOutputStyle = (type: string) => {
    switch (type) {
      case 'stdout':
        return 'text-gray-300';
      case 'stderr':
        return 'text-red-400';
      case 'debug':
        return 'text-blue-400';
      default:
        return 'text-gray-300';
    }
  };

  const getOutputIcon = (type: string) => {
    switch (type) {
      case 'stderr':
        return '⚠ ';
      case 'debug':
        return '→ ';
      default:
        return '';
    }
  };

  if (!isVisible) {
    return (
      <div className="h-8 bg-editor-bg border-t border-gray-700 flex items-center px-4">
        <button
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          onClick={toggleVisible}
        >
          <ChevronUp className="w-4 h-4" />
          <span className="text-sm">控制台</span>
          <span className="text-xs text-gray-500">({outputs.length})</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-64 bg-editor-bg border-t border-gray-700">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">控制台</span>
          {outputs.length > 0 && (
            <span className="text-xs text-gray-500">({outputs.length})</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
            onClick={clearOutputs}
            disabled={outputs.length === 0}
            title="清空控制台"
          >
            <Trash2 className="w-4 h-4 text-gray-400" />
          </button>
          
          <button
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            onClick={toggleVisible}
            title="隐藏控制台"
          >
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-2 font-mono text-sm"
      >
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 py-1">
            <div className="animate-spin w-3 h-3 border border-gray-500 border-t-transparent rounded-full" />
            <span>执行中...</span>
          </div>
        )}
        
        {outputs.length === 0 && !isLoading ? (
          <div className="text-gray-500 py-2">
            运行代码后，输出将显示在这里...
          </div>
        ) : (
          outputs.map((output) => (
            <div
              key={output.id}
              className={`py-0.5 whitespace-pre-wrap break-all ${getOutputStyle(output.type)}`}
            >
              <span className="text-gray-600 text-xs mr-2">
                {new Date(output.timestamp).toLocaleTimeString()}
              </span>
              <span>{getOutputIcon(output.type)}</span>
              {output.content}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
