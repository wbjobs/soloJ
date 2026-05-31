import React, { useState, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  disabled: boolean;
  isStreaming: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onStop, disabled, isStreaming }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() && !disabled && !isStreaming) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim() && !disabled && !isStreaming;

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? '正在生成回答...' : '请输入您的问题...'}
            disabled={disabled || isStreaming}
            rows={1}
            className="flex-1 resize-none border border-slate-300 rounded-lg px-4 py-3 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
            style={{ minHeight: '48px', maxHeight: '150px' }}
          />
          {isStreaming ? (
            <button
              onClick={onStop}
              className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-colors"
              title="停止生成"
            >
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          按 Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
