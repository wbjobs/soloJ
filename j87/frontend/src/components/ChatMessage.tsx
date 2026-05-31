import React, { useState } from 'react';
import { User, Bot, ChevronDown, ChevronUp, FileText, BookOpen } from 'lucide-react';
import type { Message, Source } from '../types';
import { parseCitations } from '../utils/citations';

interface ChatMessageProps {
  message: Message;
  onCitationClick: (chunkId: string, source?: Source) => void;
  activeChunkId?: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onCitationClick, activeChunkId }) => {
  const [showSources, setShowSources] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const renderContent = () => {
    if (isUser) {
      return <span>{message.content}</span>;
    }

    const parts = parseCitations(message.content, message.sources);

    return (
      <>
        {parts.map((part, index) => {
          if (part.type === 'text') {
            return <span key={index}>{part.content}</span>;
          }

          const isActive = part.chunkId === activeChunkId;

          return (
            <button
              key={index}
              onClick={() => onCitationClick(part.chunkId!, part.source)}
              className={`inline-flex items-center justify-center align-super text-[10px] w-5 h-5 rounded-full font-medium mx-0.5 px-1 transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-200'
                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              }`}
              title={`点击查看原文: ${part.source?.source || '来源'} · 第 ${part.source?.page || 0} 页`}
            >
              <sup>{part.source?.index || '¹'}</sup>
            </button>
          );
        })}
      </>
    );
  };

  return (
    <div className={`flex gap-4 p-4 ${isUser ? 'bg-white' : 'bg-slate-50'}`}>
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-indigo-600' : 'bg-emerald-600'
        }`}
      >
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-slate-800">
            {isUser ? '你' : '知识库助手'}
          </span>
          <span className="text-xs text-slate-400">
            {message.timestamp.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
          {renderContent()}
          {message.streaming && (
            <span className="inline-block w-2 h-5 bg-emerald-500 ml-0.5 animate-pulse align-text-bottom" />
          )}
        </div>

        {isAssistant && !message.streaming && message.sources && message.sources.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
            >
              <BookOpen className="w-4 h-4" />
              参考片段 ({message.sources.length})
              {showSources ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showSources && (
              <div className="mt-2 space-y-2">
                {message.sources.map((source, index) => (
                  <div
                    key={source.chunk_id}
                    onClick={() => onCitationClick(source.chunk_id, source)}
                    className={`bg-white border rounded-lg p-3 cursor-pointer transition-all ${
                      activeChunkId === source.chunk_id
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {source.source}
                      {source.page > 0 && <span> · 第 {source.page} 页</span>}
                      <span className="ml-auto text-indigo-500">[{index + 1}]</span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-3">
                      {source.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
