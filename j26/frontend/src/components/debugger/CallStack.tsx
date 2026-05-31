import { Layers, ChevronRight } from 'lucide-react';
import { useDebuggerStore } from '@/stores/debuggerStore';

export function CallStack() {
  const { callStack, selectedFrameIndex, setSelectedFrameIndex } = useDebuggerStore();

  const handleFrameClick = (index: number) => {
    setSelectedFrameIndex(index);
  };

  return (
    <div className="h-full flex flex-col bg-debug-panel">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700">
        <Layers className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-300">调用栈</span>
        <span className="text-xs text-gray-500 ml-auto">
          {callStack.length} 帧
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {callStack.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            暂无调用栈
          </div>
        ) : (
          <div className="py-1">
            {callStack.map((frame, index) => (
              <div
                key={frame.id}
                className={`flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors ${
                  index === selectedFrameIndex
                    ? 'bg-accent-blue/20 border-l-2 border-accent-blue'
                    : 'hover:bg-gray-700/50 border-l-2 border-transparent'
                }`}
                onClick={() => handleFrameClick(index)}
              >
                <ChevronRight
                  className={`w-4 h-4 flex-shrink-0 transition-transform ${
                    index === selectedFrameIndex ? 'rotate-90 text-accent-blue' : 'text-gray-500'
                  }`}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    <span className={index === selectedFrameIndex ? 'text-white' : 'text-gray-300'}>
                      {frame.functionName || '<module>'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {frame.fileName}:{frame.lineNumber}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
