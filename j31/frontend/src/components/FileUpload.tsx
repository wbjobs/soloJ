import React, { useState, useCallback } from 'react';
import { Upload, Video, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadFiles } from '../services/api';

interface FileUploadProps {
  onUploadSuccess: (taskId: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, []);

  const processFiles = (files: File[]) => {
    setError(null);
    
    files.forEach((file) => {
      if (file.type.startsWith('video/')) {
        setVideoFile(file);
      } else if (file.name.endsWith('.srt')) {
        setSubtitleFile(file);
      }
    });
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setVideoFile(file);
  };

  const handleSubtitleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSubtitleFile(file);
  };

  const handleUpload = async () => {
    if (!videoFile || !subtitleFile) {
      setError('请同时上传视频和字幕文件');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const response = await uploadFiles(videoFile, subtitleFile, setUploadProgress);
      onUploadSuccess(response.taskId);
    } catch (err: any) {
      setError(err.response?.data?.error || '上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div
        className={`border-2 border-dashed rounded-xl p-8 transition-all duration-300 ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 bg-gray-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            拖拽文件到这里，或点击选择文件
          </p>
          <p className="text-sm text-gray-500 mb-6">
            支持 MP4, WebM, MOV 视频格式和 SRT 字幕格式
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary-500" />
                  <span className="font-medium text-gray-700">视频文件</span>
                </div>
                <label className="cursor-pointer text-sm text-primary-600 hover:text-primary-700">
                  选择文件
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideoSelect}
                  />
                </label>
              </div>
              {videoFile ? (
                <div className="flex items-center justify-between bg-green-50 rounded p-2">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{videoFile.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatFileSize(videoFile.size)}</span>
                    <button
                      onClick={() => setVideoFile(null)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400 text-center py-2">
                  未选择文件
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-500" />
                  <span className="font-medium text-gray-700">字幕文件</span>
                </div>
                <label className="cursor-pointer text-sm text-primary-600 hover:text-primary-700">
                  选择文件
                  <input
                    type="file"
                    accept=".srt"
                    className="hidden"
                    onChange={handleSubtitleSelect}
                  />
                </label>
              </div>
              {subtitleFile ? (
                <div className="flex items-center justify-between bg-green-50 rounded p-2">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{subtitleFile.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatFileSize(subtitleFile.size)}</span>
                    <button
                      onClick={() => setSubtitleFile(null)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400 text-center py-2">
                  未选择文件
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3 mb-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {isUploading && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>上传进度</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!videoFile || !subtitleFile || isUploading}
            className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 ${
              !videoFile || !subtitleFile || isUploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200'
            }`}
          >
            {isUploading ? '上传中...' : '开始校准'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
