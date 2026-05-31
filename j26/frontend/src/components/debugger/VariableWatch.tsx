import { useState } from 'react';
import { ChevronRight, ChevronDown, Braces, Box, Hash, Type, Quote } from 'lucide-react';
import { useDebuggerStore } from '@/stores/debuggerStore';
import type { Variable } from '@/types/debugger';

interface VariableTreeItemProps {
  variable: Variable;
  path: string;
  level: number;
}

function VariableIcon({ type }: { type: string }) {
  const iconClass = "w-4 h-4 flex-shrink-0";
  
  switch (type) {
    case 'int':
    case 'float':
      return <Hash className={`${iconClass} text-blue-400`} />;
    case 'str':
      return <Quote className={`${iconClass} text-orange-400`} />;
    case 'dict':
    case 'list':
    case 'tuple':
    case 'set':
      return <Braces className={`${iconClass} text-yellow-400`} />;
    default:
      return <Box className={`${iconClass} text-purple-400`} />;
  }
}

function VariableTreeItem({ variable, path, level }: VariableTreeItemProps) {
  const { expandedVariables, toggleVariableExpand } = useDebuggerStore();
  const isExpanded = expandedVariables.has(path);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (variable.hasChildren) {
      toggleVariableExpand(path);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 cursor-pointer transition-colors ${
          isHovered ? 'bg-gray-700/50' : ''
        }`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        {variable.hasChildren ? (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-400" />
            )}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        
        <VariableIcon type={variable.type} />
        
        <span className="text-accent-blue font-medium text-sm truncate">
          {variable.name}
        </span>
        
        <span className="text-gray-500 text-sm">:</span>
        
        <span className="text-gray-400 text-xs px-1">
          <Type className="w-3 h-3 inline mr-0.5" />
          {variable.type}
        </span>
        
        <span className="text-accent-green text-sm truncate ml-2">
          {variable.value}
        </span>
      </div>
      
      {isExpanded && variable.children && variable.children.length > 0 && (
        <div className="variable-tree">
          {variable.children.map((child, index) => (
            <VariableTreeItem
              key={`${path}-${child.name}-${index}`}
              variable={child}
              path={`${path}-${child.name}`}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function VariableWatch() {
  const { locals, globals } = useDebuggerStore();
  const [activeTab, setActiveTab] = useState<'locals' | 'globals'>('locals');

  const variables = activeTab === 'locals' ? locals : globals;

  return (
    <div className="h-full flex flex-col bg-debug-panel">
      <div className="flex border-b border-gray-700">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'locals'
              ? 'text-white bg-gray-700 border-b-2 border-accent-blue'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('locals')}
        >
          局部变量
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'globals'
              ? 'text-white bg-gray-700 border-b-2 border-accent-blue'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('globals')}
        >
          全局变量
        </button>
      </div>
      
      <div className="flex-1 overflow-auto">
        {variables.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            暂无变量
          </div>
        ) : (
          <div className="py-1">
            {variables.map((variable, index) => (
              <VariableTreeItem
                key={`${activeTab}-${variable.name}-${index}`}
                variable={variable}
                path={`${activeTab}-${variable.name}`}
                level={0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
