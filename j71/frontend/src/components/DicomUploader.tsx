import React, { useCallback, useState } from 'react';

interface DicomUploaderProps {
  onFileSelected: (file: File) => void;
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
  error: string | null;
}

const DicomUploader: React.FC<DicomUploaderProps> = ({
  onFileSelected,
  onFilesSelected,
  isLoading,
  error,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);

  const isValidDicomFile = (name: string) =>
    name.toLowerCase().endsWith('.dcm') || name.toLowerCase().endsWith('.dicom');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((f) => isValidDicomFile(f.name));
      if (files.length === 0) {
        alert('请选择 .dcm 或 .dicom 格式的文件');
        return;
      }

      setSelectedFileNames(files.map((f) => f.name));

      if (files.length === 1) {
        onFileSelected(files[0]);
      } else {
        onFilesSelected(files);
      }
    },
    [onFileSelected, onFilesSelected]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files).filter((f) => isValidDicomFile(f.name));
      if (fileArray.length === 0) {
        alert('请选择 .dcm 或 .dicom 格式的文件');
        return;
      }

      setSelectedFileNames(fileArray.map((f) => f.name));

      if (fileArray.length === 1) {
        onFileSelected(fileArray[0]);
      } else {
        onFilesSelected(fileArray);
      }
    },
    [onFileSelected, onFilesSelected]
  );

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : error
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        <input
          type="file"
          accept=".dcm,.dicom"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="flex flex-col items-center">
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-lg font-medium text-gray-700">正在处理 DICOM 文件...</p>
              {selectedFileNames.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">{selectedFileNames.join(', ')}</p>
              )}
            </>
          ) : (
            <>
              <svg
                className={`w-16 h-16 mb-4 ${
                  isDragging ? 'text-blue-500' : error ? 'text-red-400' : 'text-gray-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-lg font-medium text-gray-700">
                拖拽 DICOM 文件到这里，或点击选择
              </p>
              <p className="text-sm text-gray-500 mt-1">支持 .dcm / .dicom 格式，可多选批量脱敏</p>
              {selectedFileNames.length > 0 && !isLoading && (
                <div className="mt-3 flex flex-wrap gap-1 justify-center">
                  {selectedFileNames.map((name, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </p>
        </div>
      )}
    </div>
  );
};

export default DicomUploader;
