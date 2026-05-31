import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadVideo } from '../services/api.js';

const Home = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'video/mp4') {
        setUploadError('请选择MP4格式的视频文件');
        return;
      }
      setSelectedFile(file);
      setUploadError('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type !== 'video/mp4') {
        setUploadError('请选择MP4格式的视频文件');
        return;
      }
      setSelectedFile(file);
      setUploadError('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('请先选择视频文件');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const result = await uploadVideo(selectedFile);
      navigate(`/room/${result.roomId}?host=1&hostId=${result.hostId}`);
    } catch (error) {
      setUploadError(error.message || '上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) {
      setJoinError('请输入房间ID');
      return;
    }
    navigate(`/room/${joinRoomId.trim().toUpperCase()}`);
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>多人实时审片系统</h1>
        <p>上传视频，创建房间，邀请团队成员实时同步观看并添加批注</p>
      </div>

      <div className="card">
        <h2>创建新房间</h2>

        <div
          className={`file-upload ${isDragging ? 'dragover' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {selectedFile ? (
            <div className="file-info">
              已选择: {selectedFile.name}
              <br />
              大小: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </div>
          ) : (
            <p>点击或拖拽MP4视频到此处上传</p>
          )}
        </div>

        {uploadError && <div className="error">{uploadError}</div>}

        <button
          className="btn btn-primary"
          style={{ marginTop: '20px' }}
          onClick={handleUpload}
          disabled={isUploading}
        >
          {isUploading ? '上传中...' : '上传并创建房间'}
        </button>

        <div className="divider">
          <span>或</span>
        </div>

        <h2>加入房间</h2>

        <div className="form-group">
          <label>输入房间ID</label>
          <input
            type="text"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
            placeholder="例如: ABC123"
            maxLength={6}
          />
        </div>

        {joinError && <div className="error">{joinError}</div>}

        <button
          className="btn btn-secondary"
          onClick={handleJoinRoom}
        >
          加入房间
        </button>
      </div>
    </div>
  );
};

export default Home;
