import { Package, Settings, Moon, Sun, Download, Upload } from 'lucide-react';
import { useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';

interface ToolbarProps {
  loadedPackages: string[];
  onLoadPackage: (pkg: string) => Promise<boolean>;
}

export function Toolbar({ loadedPackages, onLoadPackage }: ToolbarProps) {
  const { code, theme, setTheme } = useEditorStore();
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [newPackage, setNewPackage] = useState('');
  const [loadingPackage, setLoadingPackage] = useState(false);

  const handleLoadPackage = async () => {
    if (!newPackage.trim()) return;
    
    setLoadingPackage(true);
    try {
      await onLoadPackage(newPackage.trim());
      setNewPackage('');
    } finally {
      setLoadingPackage(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'main.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.py';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          useEditorStore.getState().setCode(content);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <>
      <div className="h-12 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white">
            <span className="text-yellow-400">Py</span>
            <span className="text-blue-400">WASM</span>
            <span className="text-gray-400 text-sm ml-1">Debugger</span>
          </span>
        </div>

        <div className="w-px h-6 bg-gray-700 mx-4" />

        <div className="flex items-center gap-1">
          <button
            className="p-2 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            onClick={handleImport}
            title="导入文件"
          >
            <Upload className="w-4 h-4" />
          </button>
          
          <button
            className="p-2 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
            onClick={handleExport}
            title="导出文件"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700 mx-2" />

        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
          onClick={() => setShowPackageModal(true)}
          title="包管理"
        >
          <Package className="w-4 h-4" />
          <span className="text-sm">包管理</span>
          {loadedPackages.length > 0 && (
            <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
              {loadedPackages.length}
            </span>
          )}
        </button>

        <div className="flex-1" />

        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
          onClick={() => setTheme(theme === 'vs-dark' ? 'light' : 'vs-dark')}
          title="切换主题"
        >
          {theme === 'vs-dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
          title="设置"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {showPackageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-96 max-h-96 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">包管理</h3>
              <button
                className="p-1 rounded hover:bg-gray-700"
                onClick={() => setShowPackageModal(false)}
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPackage}
                  onChange={(e) => setNewPackage(e.target.value)}
                  placeholder="输入包名 (如: numpy, pandas)"
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadPackage()}
                />
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                  onClick={handleLoadPackage}
                  disabled={loadingPackage || !newPackage.trim()}
                >
                  {loadingPackage ? '加载中...' : '加载'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                提示: 部分包可能需要从 PyPI 下载，可能需要较长时间
              </p>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <div className="text-sm text-gray-400 mb-2">已加载的包:</div>
              {loadedPackages.length === 0 ? (
                <div className="text-gray-500 text-sm">暂无已加载的包</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {loadedPackages.map((pkg) => (
                    <span
                      key={pkg}
                      className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-sm"
                    >
                      {pkg}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
