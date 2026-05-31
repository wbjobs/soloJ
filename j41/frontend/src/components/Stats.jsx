import React from 'react';

function Stats({ tasks, logs }) {
  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((t) => t.status === 'active').length;
  const successExecutions = logs.filter((l) => l.status === 'success').length;
  const failedExecutions = logs.filter((l) => l.status === 'failed').length;
  const conflictExecutions = logs.filter((l) => l.status === 'conflict').length;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-value">{totalTasks}</div>
        <div className="stat-label">总任务数</div>
      </div>
      <div className="stat-card success">
        <div className="stat-value">{activeTasks}</div>
        <div className="stat-label">运行中任务</div>
      </div>
      <div className="stat-card warning">
        <div className="stat-value">{successExecutions}</div>
        <div className="stat-label">成功执行次数</div>
      </div>
      <div className="stat-card danger">
        <div className="stat-value">{failedExecutions}</div>
        <div className="stat-label">失败执行次数</div>
      </div>
      {conflictExecutions > 0 && (
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)' }}>
          <div className="stat-value">{conflictExecutions}</div>
          <div className="stat-label">冲突执行次数</div>
        </div>
      )}
    </div>
  );
}

export default Stats;
