import { useState, useRef } from 'react';

export default function ImageUploader({ onImageLoad, label, icon }) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    onImageLoad(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        className={`upload-zone rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragging ? 'dragover' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/png,image/bmp,image/gif"
        />
        
        {preview ? (
          <div className="space-y-4">
            <img 
              src={preview} 
              alt="Preview" 
              className="result-image mx-auto max-h-48"
            />
            <p className="text-sm text-gray-400 truncate">{fileName}</p>
            <p className="text-xs text-neon-cyan">点击或拖拽更换图片</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-6xl animate-float">{icon}</div>
            <p className="text-lg font-medium text-gray-300">{label}</p>
            <p className="text-sm text-gray-500">
              拖拽图片到此处或点击上传
            </p>
            <p className="text-xs text-gray-600">
              支持 PNG, BMP, GIF (无损格式)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
