import React from 'react';

function ExecutionLogs({ logs }) {
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      success: { class: 'status-success', text: '成功' },
      failed: { class: 'status-failed', text: '失败' },
      conflict: { class: 'status-conflict', text: '冲突' },
    };
    
    const statusInfo = statusMap[status] || statusMap.failed;
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.text}</span>;
  };

  if (logs.length === 0) {
    return (
      <div className="section">
        <h2>执行日志</h2>
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <p>暂无执行日志</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <h2>最近执行日志</h2>
      <div className="logs-container">
        {logs.map((log) => (
          <div key={log.id} className="log-item">
            <div className="log-header">
              <div>
                <span className="log-task-name">{log.taskName}</span>
                <span style={{ marginLeft: '10px' }}>{getStatusBadge(log.status)}</span>
              </div>
              <div className="log-meta">
                <span className="worker-info">👷 {log.workerId}</span>
                <span style={{ marginLeft: '10px' }}>{formatDate(log.createdAt)}</span>
                <span style={{ marginLeft: '10px' }}>耗时: {log.duration}ms</span>
              </div>
            </div>
            {log.output && (
              <div className="log-output">
                {log.output.trim()}
              </div>
            )}
            {log.error && (
              <div className="log-output log-error">
                错误: {log.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ExecutionLogs;
