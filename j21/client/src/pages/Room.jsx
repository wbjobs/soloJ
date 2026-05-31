import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { getRoomInfo, exportAnnotations } from '../services/api.js';
import socketService from '../services/socket.js';
import VideoPlayer from '../components/VideoPlayer.jsx';
import AnnotationCanvas from '../components/AnnotationCanvas.jsx';
import AnnotationList from '../components/AnnotationList.jsx';
import { exportToPDF } from '../utils/pdfExport.js';

const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const playerRef = useRef(null);

  const [roomInfo, setRoomInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [annotations, setAnnotations] = useState([]);
  const [users, setUsers] = useState([]);
  const [videoDimensions, setVideoDimensions] = useState(null);
  const [userId] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('hostId') || uuidv4();
  });
  const [userName, setUserName] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('host') ? '主持人' : `用户${Math.floor(Math.random() * 1000)}`;
  });
  const [isHost] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('host') === '1';
  });
  const [pendingAnnotation, setPendingAnnotation] = useState(null);
  const [annotationText, setAnnotationText] = useState('');
  const [isRemoteControl, setIsRemoteControl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hiddenAnnotations, setHiddenAnnotations] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchRoomInfo = async () => {
      try {
        const info = await getRoomInfo(roomId);
        setRoomInfo(info);
        setAnnotations(info.annotations || []);
      } catch (err) {
        setError(err.message || '房间不存在');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomInfo();
  }, [roomId]);

  useEffect(() => {
    if (!roomInfo) return;

    socketService.connect();
    socketService.joinRoom(roomId, userId, userName);

    const handlePlay = ({ currentTime }) => {
      if (playerRef.current && !isRemoteControl) {
        setIsRemoteControl(true);
        playerRef.current.currentTime(currentTime);
        playerRef.current.play();
        setTimeout(() => setIsRemoteControl(false), 500);
      }
    };

    const handlePause = ({ currentTime }) => {
      if (playerRef.current && !isRemoteControl) {
        setIsRemoteControl(true);
        playerRef.current.currentTime(currentTime);
        playerRef.current.pause();
        setTimeout(() => setIsRemoteControl(false), 500);
      }
    };

    const handleSeek = ({ currentTime }) => {
      if (playerRef.current && !isRemoteControl) {
        setIsRemoteControl(true);
        playerRef.current.currentTime(currentTime);
        setTimeout(() => setIsRemoteControl(false), 500);
      }
    };

    const handleSyncState = ({ isPlaying, currentTime }) => {
      if (playerRef.current && !isRemoteControl) {
        setIsRemoteControl(true);
        playerRef.current.currentTime(currentTime);
        if (isPlaying) {
          playerRef.current.play();
        } else {
          playerRef.current.pause();
        }
        setTimeout(() => setIsRemoteControl(false), 500);
      }
    };

    const handleAnnotationAdded = (annotation) => {
      setAnnotations((prev) => [...prev, { ...annotation, replies: [] }]);
    };

    const handleAnnotationDeleted = ({ annotationId }) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    };

    const handleReplyAdded = (reply) => {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === reply.annotationId
            ? { ...a, replies: [...(a.replies || []), reply] }
            : a
        )
      );
    };

    const handleReplyDeleted = ({ replyId, annotationId }) => {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === annotationId
            ? { ...a, replies: (a.replies || []).filter((r) => r.id !== replyId) }
            : a
        )
      );
    };

    const handleAnnotationVisibilityChanged = ({ annotationId, isVisible }) => {
      setHiddenAnnotations((prev) => {
        const newSet = new Set(prev);
        if (isVisible) {
          newSet.delete(annotationId);
        } else {
          newSet.add(annotationId);
        }
        return newSet;
      });
    };

    const handleUserJoined = ({ users: roomUsers }) => {
      setUsers(roomUsers);
    };

    const handleUserLeft = ({ users: roomUsers }) => {
      setUsers(roomUsers);
    };

    socketService.on('play', handlePlay);
    socketService.on('pause', handlePause);
    socketService.on('seek', handleSeek);
    socketService.on('sync-state', handleSyncState);
    socketService.on('annotation-added', handleAnnotationAdded);
    socketService.on('annotation-deleted', handleAnnotationDeleted);
    socketService.on('reply-added', handleReplyAdded);
    socketService.on('reply-deleted', handleReplyDeleted);
    socketService.on('annotation-visibility-changed', handleAnnotationVisibilityChanged);
    socketService.on('user-joined', handleUserJoined);
    socketService.on('user-left', handleUserLeft);

    return () => {
      socketService.off('play', handlePlay);
      socketService.off('pause', handlePause);
      socketService.off('seek', handleSeek);
      socketService.off('sync-state', handleSyncState);
      socketService.off('annotation-added', handleAnnotationAdded);
      socketService.off('annotation-deleted', handleAnnotationDeleted);
      socketService.off('reply-added', handleReplyAdded);
      socketService.off('reply-deleted', handleReplyDeleted);
      socketService.off('annotation-visibility-changed', handleAnnotationVisibilityChanged);
      socketService.off('user-joined', handleUserJoined);
      socketService.off('user-left', handleUserLeft);
      socketService.disconnect();
    };
  }, [roomId, userId, userName, roomInfo, isRemoteControl]);

  const handlePlay = useCallback((time) => {
    if (!isRemoteControl) {
      socketService.play(roomId, time);
    }
  }, [roomId, isRemoteControl]);

  const handlePause = useCallback((time) => {
    if (!isRemoteControl) {
      socketService.pause(roomId, time);
    }
  }, [roomId, isRemoteControl]);

  const handleSeek = useCallback((time) => {
    if (!isRemoteControl) {
      socketService.seek(roomId, time);
    }
  }, [roomId, isRemoteControl]);

  const handleTimeUpdate = useCallback((time) => {
    setCurrentTime(time);
  }, []);

  const handleAddAnnotation = useCallback((rect) => {
    setPendingAnnotation({
      ...rect,
      timestamp: currentTime,
    });
  }, [currentTime]);

  const handleSubmitAnnotation = () => {
    if (!pendingAnnotation) return;

    const annotation = {
      ...pendingAnnotation,
      userId,
      userName,
      text: annotationText.trim(),
    };

    socketService.addAnnotation(roomId, annotation);
    setPendingAnnotation(null);
    setAnnotationText('');
  };

  const handleCancelAnnotation = () => {
    setPendingAnnotation(null);
    setAnnotationText('');
  };

  const handleAnnotationClick = (timestamp) => {
    if (playerRef.current) {
      playerRef.current.currentTime(timestamp);
      socketService.seek(roomId, timestamp);
    }
  };

  const handleDeleteAnnotation = (annotationId) => {
    socketService.deleteAnnotation(roomId, annotationId);
  };

  const handleAddReply = (annotationId, text) => {
    socketService.addReply(roomId, annotationId, {
      userId,
      userName,
      text,
    });
  };

  const handleDeleteReply = (annotationId, replyId) => {
    socketService.deleteReply(roomId, replyId);
  };

  const handleToggleVisibility = (annotationId, isVisible) => {
    setHiddenAnnotations((prev) => {
      const newSet = new Set(prev);
      if (isVisible) {
        newSet.delete(annotationId);
      } else {
        newSet.add(annotationId);
      }
      return newSet;
    });
    socketService.toggleAnnotationVisibility(roomId, annotationId, isVisible);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const exportData = await exportAnnotations(roomId);
      const videoElement = playerRef.current?.getVideoElement();
      await exportToPDF(exportData, videoElement);
    } catch (error) {
      console.error('Export error:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return (
      <div className="home-container">
        <div className="card">
          <h2>错误</h2>
          <p className="error">{error}</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: '20px' }}
            onClick={() => navigate('/')}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="room-container">
      <div className="room-header">
        <div className="room-info">
          <h2>
            {roomInfo?.video?.name}
            <span className="room-id">
              房间ID: {roomId}
              <button className="copy-btn" onClick={copyRoomId}>
                {copied ? '✓ 已复制' : '复制'}
              </button>
            </span>
          </h2>
        </div>
        <div className="room-users">
          <button
            className="btn btn-primary btn-small"
            onClick={handleExportPDF}
            disabled={isExporting}
            style={{ marginRight: '15px' }}
          >
            {isExporting ? '导出中...' : '导出PDF报告'}
          </button>
          <div className="sync-indicator">
            <span className="dot"></span>
            实时同步中
          </div>
          {users.map((user, index) => (
            <span key={index} className="user-badge">
              {user.userName}
            </span>
          ))}
        </div>
      </div>

      <div className="room-content">
        <div className="video-section">
          {roomInfo && (
            <div className="video-container">
              <VideoPlayer
                ref={playerRef}
                src={roomInfo.video.url}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onTimeUpdate={handleTimeUpdate}
                onVideoDimensionsChange={setVideoDimensions}
              />
              <AnnotationCanvas
                annotations={annotations}
                currentTime={currentTime}
                onAddAnnotation={handleAddAnnotation}
                disabled={!!pendingAnnotation}
                videoDimensions={videoDimensions}
                hiddenAnnotations={hiddenAnnotations}
              />
            </div>
          )}
        </div>

        <div className="annotation-sidebar">
          <div className="sidebar-header">
            <h3>批注列表 ({annotations.length})</h3>
          </div>

          <AnnotationList
            annotations={annotations}
            onAnnotationClick={handleAnnotationClick}
            onDeleteAnnotation={handleDeleteAnnotation}
            currentUserId={userId}
            onAddReply={handleAddReply}
            onDeleteReply={handleDeleteReply}
            onToggleVisibility={handleToggleVisibility}
            hiddenAnnotations={hiddenAnnotations}
          />

          <div className="annotation-form">
            {pendingAnnotation ? (
              <>
                <p className="hint">
                  在 {formatTime(pendingAnnotation.timestamp)} 位置添加批注
                </p>
                <textarea
                  value={annotationText}
                  onChange={(e) => setAnnotationText(e.target.value)}
                  placeholder="输入批注内容..."
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-primary btn-small"
                    onClick={handleSubmitAnnotation}
                  >
                    提交
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={handleCancelAnnotation}
                  >
                    取消
                  </button>
                </div>
              </>
            ) : (
              <p className="hint">
                在视频画面上拖拽鼠标框选区域添加批注
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default Room;
