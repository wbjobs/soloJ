import { useState } from 'react';

export default function ResultDisplay({ type, data, onDownload }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (type === 'text') {
      navigator.clipboard.writeText(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!data) return null;

  return (
    <div className="glass-card rounded-xl p-6 space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neon-cyan flex items-center gap-2">
          {type === 'image' ? '🖼️ 隐写结果' : '📝 提取的秘密信息'}
        </h3>
        <div className="flex gap-2">
          {type === 'text' && (
            <button
              onClick={handleCopy}
              className="px-3 py-1 text-sm rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors"
            >
              {copied ? '✓ 已复制' : '📋 复制'}
            </button>
          )}
          {type === 'image' && (
            <button
              onClick={onDownload}
              className="px-3 py-1 text-sm rounded-lg btn-primary text-white font-medium"
            >
              ⬇️ 下载
            </button>
          )}
        </div>
      </div>

      <div className="bg-dark-900/50 rounded-lg p-4">
        {type === 'image' ? (
          <img src={data} alt="Result" className="result-image mx-auto" />
        ) : (
          <div className="font-mono text-sm text-gray-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {data}
          </div>
        )}
      </div>
    </div>
  );
}
