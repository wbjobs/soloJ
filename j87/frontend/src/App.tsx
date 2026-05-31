import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, AlertCircle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { chatStream, healthCheck, listDocuments, getDocumentContent } from './services/api';
import type { Message, Source } from './types';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [vectorstoreSize, setVectorstoreSize] = useState(0);
  const [backendConnected, setBackendConnected] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [activeChunkId, setActiveChunkId] = useState<string | undefined>(undefined);
  const [activeCitationSource, setActiveCitationSource] = useState<Source | undefined>(undefined);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await healthCheck();
        setVectorstoreSize(data.vectorstore_size);
        setBackendConnected(true);
      } catch {
        setBackendConnected(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDocumentsChange = async () => {
    try {
      const data = await healthCheck();
      setVectorstoreSize(data.vectorstore_size);
    } catch {
      // ignore
    }
  };

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  const appendToMessage = useCallback((id: string, token: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, content: msg.content + token } : msg
      )
    );
  }, []);

  const handleSend = async (question: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      timestamp: new Date(),
      streaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setActiveChunkId(undefined);
    setActiveCitationSource(undefined);

    try {
      const controller = await chatStream(question, {
        onSources: (sources: Source[]) => {
          updateMessage(assistantId, { sources });
        },
        onToken: (token: string) => {
          appendToMessage(assistantId, token);
        },
        onDone: () => {
          updateMessage(assistantId, { streaming: false });
        },
        onError: (error: string) => {
          updateMessage(assistantId, {
            content: `抱歉，处理时出现错误: ${error}`,
            streaming: false,
          });
        },
      });

      abortControllerRef.current = controller;
    } catch {
      updateMessage(assistantId, {
        content: '抱歉，处理您的问题时出现错误。请确保后端服务正在运行，并且 Ollama 已启动。',
        streaming: false,
      });
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages((prev) =>
      prev.map((msg) =>
        msg.streaming ? { ...msg, streaming: false } : msg
      )
    );
  };

  const handleCitationClick = async (chunkId: string, source?: Source) => {
    setActiveChunkId(chunkId);
    setActiveCitationSource(source);

    if (!source) return;

    try {
      const docList = await listDocuments();
      const matchedFile = docList.documents.find((f) => {
        const displayName = f.split('_').slice(1).join('_');
        return displayName === source.source || f === source.source;
      });

      if (matchedFile) {
        await getDocumentContent(matchedFile);
      }
    } catch {
      // ignore error, sidebar will handle it
    }
  };

  const hasStreamingMessage = messages.some((msg) => msg.streaming);

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        onDocumentsChange={handleDocumentsChange}
        vectorstoreSize={vectorstoreSize}
        activeChunkId={activeChunkId}
      />

      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-800">知识问答</h2>
            </div>
            <div className="flex items-center gap-2">
              {activeCitationSource && (
                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                  已定位: {activeCitationSource.source} · 第 {activeCitationSource.page + 1} 页
                </span>
              )}
              {backendConnected ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  后端已连接
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  后端未连接
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <MessageSquare className="w-16 h-16 mb-4 text-slate-300" />
              <h3 className="text-xl font-medium text-slate-600 mb-2">
                欢迎使用 RAG 知识库问答系统
              </h3>
              <p className="text-sm max-w-md text-center">
                {vectorstoreSize > 0
                  ? '知识库已就绪，请在下方输入您的问题，我会基于本地文档为您解答。回答中的上标标记可点击查看原文。'
                  : '请先在左侧上传 PDF 或 TXT 文档，上传完成后即可开始问答。回答中的上标标记可点击查看原文。'}
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onCitationClick={handleCitationClick}
                  activeChunkId={activeChunkId}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          disabled={!backendConnected}
          isStreaming={hasStreamingMessage}
        />
      </div>
    </div>
  );
};

export default App;
