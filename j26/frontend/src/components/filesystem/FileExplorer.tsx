import { useState } from 'react';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, FileCode } from 'lucide-react';
import type { FileNode } from '@/hooks/useFileSystem';

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  currentPath: string;
}

interface FileTreeItemProps {
  node: FileNode;
  path: string;
  level: number;
  onFileSelect: (path: string) => void;
}

function FileTreeItem({ node, path, level, onFileSelect }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(level === 0);
  const fullPath = path === '/' ? `/${node.name}` : `${path}/${node.name}`;

  const handleClick = () => {
    if (node.type === 'directory') {
      setExpanded(!expanded);
    } else {
      onFileSelect(fullPath);
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 hover:bg-gray-700/50 cursor-pointer transition-colors group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' ? (
          <>
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            {expanded ? (
              <FolderOpen className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-4 flex-shrink-0" />
            {node.name.endsWith('.py') ? (
              <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
          </>
        )}
        
        <span className="text-sm text-gray-300 truncate">{node.name}</span>
      </div>
      
      {node.type === 'directory' && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.name}
              node={child}
              path={fullPath}
              level={level + 1}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileExplorer({ files, onFileSelect, onCreateFile, currentPath }: FileExplorerProps) {
  return (
    <div className="h-full flex flex-col bg-debug-panel">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-gray-300">文件浏览器</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            onClick={() => onCreateFile(currentPath)}
            title="新建文件"
          >
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {files.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            暂无文件
          </div>
        ) : (
          files.map((node) => (
            <FileTreeItem
              key={node.name}
              node={node}
              path="/"
              level={0}
              onFileSelect={onFileSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
