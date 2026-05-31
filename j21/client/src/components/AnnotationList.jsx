import React, { useState } from 'react';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const AnnotationList = ({
  annotations,
  onAnnotationClick,
  onDeleteAnnotation,
  currentUserId,
  onAddReply,
  onDeleteReply,
  onToggleVisibility,
  hiddenAnnotations,
}) => {
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState(new Set());

  const sortedAnnotations = [...annotations].sort((a, b) => a.timestamp - b.timestamp);

  const handleSubmitReply = (annotationId) => {
    if (!replyText.trim()) return;
    onAddReply?.(annotationId, replyText.trim());
    setReplyText('');
    setReplyingTo(null);
  };

  const toggleReplies = (annotationId) => {
    const newExpanded = new Set(expandedReplies);
    if (newExpanded.has(annotationId)) {
      newExpanded.delete(annotationId);
    } else {
      newExpanded.add(annotationId);
    }
    setExpandedReplies(newExpanded);
  };

  const isHidden = (annotationId) => hiddenAnnotations?.has(annotationId);

  return (
    <div className="annotation-list">
      {sortedAnnotations.length === 0 ? (
        <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
          暂无批注，在视频上拖拽添加批注
        </p>
      ) : (
        sortedAnnotations.map((annotation) => (
          <div
            key={annotation.id}
            className={`annotation-item ${isHidden(annotation.id) ? 'annotation-hidden' : ''}`}
          >
            <div
              onClick={() => onAnnotationClick?.(annotation.timestamp)}
              style={{ cursor: 'pointer' }}
            >
              <div className="timestamp">
                {formatTime(annotation.timestamp)}
                {annotation.replies?.length > 0 && (
                  <span style={{ marginLeft: '10px', color: '#667eea', fontSize: '0.8rem' }}>
                    {annotation.replies.length} 条回复
                  </span>
                )}
              </div>
              <div className="author">{annotation.userName}</div>
              <div className="text">{annotation.text || '无评论'}</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-small btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility?.(annotation.id, !isHidden(annotation.id));
                }}
              >
                {isHidden(annotation.id) ? '显示' : '隐藏'}
              </button>

              <button
                className="btn btn-small btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  if (replyingTo === annotation.id) {
                    setReplyingTo(null);
                    setReplyText('');
                  } else {
                    setReplyingTo(annotation.id);
                    setReplyText('');
                  }
                }}
              >
                回复
              </button>

              {annotation.replies?.length > 0 && (
                <button
                  className="btn btn-small btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleReplies(annotation.id);
                  }}
                >
                  {expandedReplies.has(annotation.id) ? '收起回复' : '展开回复'}
                </button>
              )}

              {annotation.userId === currentUserId && (
                <button
                  className="btn btn-small btn-secondary"
                  style={{ background: '#ff6b6b' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteAnnotation?.(annotation.id);
                  }}
                >
                  删除
                </button>
              )}
            </div>

            {replyingTo === annotation.id && (
              <div style={{ marginTop: '12px' }} onClick={(e) => e.stopPropagation()}>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="输入回复内容..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#0f3460',
                    border: '1px solid #2d3a5f',
                    borderRadius: '6px',
                    color: '#eaeaea',
                    resize: 'vertical',
                    minHeight: '60px',
                    marginBottom: '8px',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-small btn-primary"
                    onClick={() => handleSubmitReply(annotation.id)}
                    disabled={!replyText.trim()}
                  >
                    发送
                  </button>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText('');
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {expandedReplies.has(annotation.id) && annotation.replies?.length > 0 && (
              <div
                className="replies-container"
                onClick={(e) => e.stopPropagation()}
              >
                {annotation.replies.map((reply) => (
                  <div key={reply.id} className="reply-item">
                    <div className="reply-author">{reply.userName}</div>
                    <div className="reply-text">{reply.text}</div>
                    {reply.userId === currentUserId && (
                      <button
                        className="btn btn-small btn-secondary"
                        style={{ marginTop: '6px', fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => onDeleteReply?.(annotation.id, reply.id)}
                      >
                        删除回复
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default AnnotationList;
