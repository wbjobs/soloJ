import { useState } from 'react';
import { Circle, CircleDot, Trash2, Edit2, Check, X, Filter } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';

export function BreakpointList() {
  const { breakpoints, removeBreakpoint, toggleBreakpoint, updateBreakpointCondition } = useEditorStore();
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [editingCondition, setEditingCondition] = useState('');

  const startEditing = (lineNumber: number, currentCondition?: string) => {
    setEditingLine(lineNumber);
    setEditingCondition(currentCondition || '');
  };

  const saveCondition = (lineNumber: number) => {
    updateBreakpointCondition(lineNumber, editingCondition.trim() || undefined);
    setEditingLine(null);
    setEditingCondition('');
  };

  const cancelEditing = () => {
    setEditingLine(null);
    setEditingCondition('');
  };

  return (
    <div className="h-full flex flex-col bg-debug-panel">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Circle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium text-gray-300">断点</span>
          <span className="text-xs text-gray-500">({breakpoints.length})</span>
        </div>
        
        {breakpoints.length > 0 && (
          <button
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            onClick={() => breakpoints.forEach(bp => removeBreakpoint(bp.lineNumber))}
            title="清除所有断点"
          >
            <Trash2 className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Filter className="w-3 h-3" />
          <span>点击行号添加断点，右键设置条件</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {breakpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm px-4 text-center">
            <Circle className="w-8 h-8 mb-2 opacity-50" />
            <p>暂无断点</p>
            <p className="text-xs mt-1">点击编辑器左侧行号区域添加断点</p>
          </div>
        ) : (
          <div className="py-1">
            {breakpoints.map((bp) => (
              <div
                key={bp.id}
                className={`group ${bp.isConditional ? 'border-l-2 border-yellow-500' : 'border-l-2 border-transparent'}`}
              >
                <div className="flex items-center gap-2 px-4 py-2 hover:bg-gray-700/50 transition-colors">
                  <button
                    className="p-1 rounded hover:bg-gray-600 transition-colors"
                    onClick={() => toggleBreakpoint(bp.lineNumber)}
                  >
                    {bp.enabled ? (
                      bp.isConditional ? (
                        <Filter className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <CircleDot className="w-4 h-4 text-red-500" />
                      )
                    ) : (
                      <Circle className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-300">
                      第 {bp.lineNumber} 行
                    </div>
                    {bp.isConditional && bp.condition && editingLine !== bp.lineNumber && (
                      <div className="text-xs text-yellow-400 font-mono truncate" title={bp.condition}>
                        条件: {bp.condition}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 rounded hover:bg-gray-600 transition-colors"
                      onClick={() => startEditing(bp.lineNumber, bp.condition)}
                      title={bp.isConditional ? "编辑条件" : "添加条件"}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-gray-600 transition-colors"
                      onClick={() => removeBreakpoint(bp.lineNumber)}
                      title="删除断点"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                </div>

                {editingLine === bp.lineNumber && (
                  <div className="px-4 pb-3 bg-gray-800/50">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingCondition}
                        onChange={(e) => setEditingCondition(e.target.value)}
                        placeholder="输入条件表达式，如: x > 10"
                        className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white font-mono focus:outline-none focus:border-yellow-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveCondition(bp.lineNumber);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                      />
                      <button
                        className="p-1.5 rounded bg-green-600 hover:bg-green-700 transition-colors"
                        onClick={() => saveCondition(bp.lineNumber)}
                      >
                        <Check className="w-4 h-4 text-white" />
                      </button>
                      <button
                        className="p-1.5 rounded bg-gray-600 hover:bg-gray-500 transition-colors"
                        onClick={cancelEditing}
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      条件表达式在当前作用域中求值，返回 true 时中断
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
