import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Database,
  RefreshCw,
  X,
  BookOpen,
  Files,
  ArrowLeft,
  Search,
  FileText as FileTextIcon,
} from 'lucide-react';
import {
  uploadDocument,
  listDocuments,
  clearVectorstore,
  getDocumentContent,
} from '../services/api';
import type { DocumentsList, DocumentContent, DocumentChunk } from '../types';

interface SidebarProps {
  onDocumentsChange: () => void;
  vectorstoreSize: number;
  activeChunkId?: string;
}

type TabType = 'documents' | 'viewer';

const Sidebar: React.FC<SidebarProps> = ({
  onDocumentsChange,
  vectorstoreSize,
  activeChunkId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('documents');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<DocumentsList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<DocumentContent | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | null>(null);

  const chunkRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeChunkId && activeChunkId !== highlightedChunkId) {
      setHighlightedChunkId(activeChunkId);

      if (activeTab === 'viewer' && selectedDocument) {
        const element = chunkRefs.current[activeChunkId];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      const autoLoadDocument = async () => {
        try {
          if (!documents || !documents.documents.length) {
            await fetchDocuments();
          }

          let matchedFile: string | null = null;

          if (documents && documents.documents.length) {
            for (const docFile of documents.documents) {
              const content = await getDocumentContent(docFile);
              let found = false;
              for (const page of content.pages) {
                for (const chunk of page.chunks || []) {
                  if (chunk.chunk_id === activeChunkId) {
                    matchedFile = docFile;
                    found = true;
                    break;
                  }
                }
                if (found) break;
              }
              if (found) {
                setSelectedDocument(docFile);
                setDocumentContent(content);
                setActiveTab('viewer');
                setError(null);

                setTimeout(() => {
                  const el = chunkRefs.current[activeChunkId!];
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 300);
                break;
              }
            }
          }

          if (!matchedFile) {
            setError('未找到对应的文档片段');
          }
        } catch (err) {
          setError('自动加载文档失败');
        }
      };

      autoLoadDocument();
    }
  }, [activeChunkId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await listDocuments();
      setDocuments(data);
    } catch (err) {
      setError('加载文档列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const loadDocumentContent = async (filename: string) => {
    try {
      setDocLoading(true);
      setSelectedDocument(filename);
      const data = await getDocumentContent(filename);
      setDocumentContent(data);
      setActiveTab('viewer');
      setError(null);
    } catch (err) {
      setError('加载文档内容失败');
    } finally {
      setDocLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) {
      setError('只支持 PDF 和 TXT 格式的文件');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      const result = await uploadDocument(file);
      const filtered = result.raw_pages - result.chunks;
      const filterMsg = filtered > 0 ? `，已过滤 ${filtered} 个低质量片段` : '';
      setSuccess(`成功上传 ${result.filename}，已分 ${result.chunks} 个有效片段${filterMsg}`);
      await fetchDocuments();
      onDocumentsChange();
    } catch (err) {
      setError('文件上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleClear = async () => {
    if (window.confirm('确定要清空知识库吗？此操作不可撤销。')) {
      try {
        await clearVectorstore();
        setSuccess('知识库已清空');
        await fetchDocuments();
        onDocumentsChange();
      } catch (err) {
        setError('清空知识库失败');
      }
    }
  };

  const getDisplayName = (filename: string) => {
    const parts = filename.split('_');
    return parts.length > 1 ? parts.slice(1).join('_') : filename;
  };

  const handleBackToDocuments = () => {
    setActiveTab('documents');
    setHighlightedChunkId(null);
  };

  const renderDocumentChunk = (chunk: DocumentChunk) => {
    const isHighlighted = chunk.chunk_id === highlightedChunkId || chunk.chunk_id === activeChunkId;

    return (
      <div
        key={chunk.chunk_id}
        ref={(el) => {
          chunkRefs.current[chunk.chunk_id] = el;
        }}
        className={`p-3 rounded-lg text-sm leading-relaxed mb-2 transition-all duration-300 ${
          isHighlighted
            ? 'bg-yellow-100 border-2 border-yellow-500 shadow-md'
            : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
        }`}
      >
        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
          <FileTextIcon className="w-3 h-3" />
          <span>片段 {chunk.index + 1}</span>
          <span className="text-slate-400">|</span>
          <span>ID: {chunk.chunk_id.slice(0, 8)}...</span>
        </div>
        <p className="text-slate-700 whitespace-pre-wrap">{chunk.content}</p>
      </div>
    );
  };

  return (
    <div className="w-96 bg-slate-50 border-r border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Database className="w-6 h-6 text-indigo-600" />
          RAG 知识库
        </h1>
        <p className="text-sm text-slate-500 mt-1">本地知识库问答系统</p>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('documents');
            setHighlightedChunkId(null);
          }}
          className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'documents'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Files className="w-4 h-4" />
          文档管理
        </button>
        <button
          onClick={() => setActiveTab('viewer')}
          className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'viewer'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          原文查看
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'documents' && (
          <div>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                dragOver
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-100'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <input
                type="file"
                id="fileInput"
                className="hidden"
                accept=".pdf,.txt"
                onChange={handleFileInput}
                disabled={uploading}
              />
              {uploading ? (
                <RefreshCw className="w-8 h-8 text-indigo-500 mx-auto mb-2 animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              )}
              <p className="text-sm text-slate-600">
                {uploading ? '上传中...' : '拖拽文件或点击上传'}
              </p>
              <p className="text-xs text-slate-400 mt-1">支持 PDF、TXT 格式</p>
            </div>

            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-red-600">{error}</p>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {success && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-green-600">{success}</p>
                <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  文档列表
                </h2>
                <button
                  onClick={fetchDocuments}
                  className="text-slate-400 hover:text-slate-600"
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-3 mb-3">
                <div className="text-xs text-slate-500">向量库片段数</div>
                <div className="text-2xl font-bold text-indigo-600">{vectorstoreSize}</div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 text-slate-400 mx-auto animate-spin" />
                  <p className="text-sm text-slate-500 mt-2">加载中...</p>
                </div>
              ) : documents && documents.documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.documents.map((doc, index) => (
                    <div
                      key={index}
                      onClick={() => loadDocumentContent(doc)}
                      className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate flex-1">
                        {getDisplayName(doc)}
                      </span>
                      <Search className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">暂无上传的文档</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'viewer' && (
          <div>
            {!selectedDocument && (
              <div className="text-center py-12 text-slate-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm mb-2">请选择一个文档查看原文</p>
                <button
                  onClick={handleBackToDocuments}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  返回文档列表
                </button>
              </div>
            )}

            {selectedDocument && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={handleBackToDocuments}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                    title="返回"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">
                      {getDisplayName(selectedDocument)}
                    </h3>
                    {documentContent && (
                      <p className="text-xs text-slate-500">
                        共 {documentContent.pages.length} 页
                      </p>
                    )}
                  </div>
                </div>

                {highlightedChunkId && (
                  <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    已定位到引用片段
                    <button
                      onClick={() => setHighlightedChunkId(null)}
                      className="ml-auto text-yellow-500 hover:text-yellow-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {docLoading ? (
                  <div className="text-center py-12">
                    <RefreshCw className="w-6 h-6 text-slate-400 mx-auto animate-spin" />
                    <p className="text-sm text-slate-500 mt-2">加载文档内容中...</p>
                  </div>
                ) : documentContent && documentContent.pages.length > 0 ? (
                  <div className="space-y-6">
                    {documentContent.pages.map((page, pageIndex) => (
                      <div key={pageIndex} className="bg-white rounded-lg border border-slate-200 p-4">
                        <div className="text-xs font-medium text-slate-500 mb-3 pb-2 border-b border-slate-100">
                          第 {page.page + 1} 页
                        </div>

                        {page.chunks && page.chunks.length > 0 ? (
                          <div className="space-y-2">
                            {page.chunks.map((chunk) => renderDocumentChunk(chunk))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-600 whitespace-pre-wrap">
                            {page.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-sm">文档内容加载失败</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200">
        <button
          onClick={handleClear}
          className="w-full py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          清空知识库
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
