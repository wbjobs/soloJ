import React from 'react';

function TaskList({ tasks, onEdit, onDelete, onToggle }) {
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getStatusBadge = (status) => {
    const statusClass = status === 'active' ? 'status-active' : 'status-inactive';
    const statusText = status === 'active' ? '运行中' : '已停止';
    return <span className={`status-badge ${statusClass}`}>{statusText}</span>;
  };

  const getLastStatusBadge = (status) => {
    if (!status) return <span className="status-badge status-pending">未执行</span>;
    
    const statusMap = {
      success: { class: 'status-success', text: '成功' },
      failed: { class: 'status-failed', text: '失败' },
      conflict: { class: 'status-conflict', text: '冲突' },
    };
    
    const statusInfo = statusMap[status] || statusMap.failed;
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.text}</span>;
  };

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <p>暂无任务，点击"新建任务"添加第一个任务</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>任务名称</th>
            <th>Cron 表达式</th>
            <th>执行命令</th>
            <th>超时时间</th>
            <th>状态</th>
            <th>最近执行</th>
            <th>最近状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <strong>{task.name}</strong>
              </td>
              <td>
                <code style={{ backgroundColor: '#f7fafc', padding: '2px 6px', borderRadius: '4px' }}>
                  {task.cronExpression}
                </code>
              </td>
              <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {task.command}
              </td>
              <td>{task.timeout} 秒</td>
              <td>{getStatusBadge(task.status)}</td>
              <td>{formatDate(task.lastExecution)}</td>
              <td>{getLastStatusBadge(task.lastStatus)}</td>
              <td>
                <div className="actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => onToggle(task)}
                    title={task.status === 'active' ? '停止' : '启动'}
                  >
                    {task.status === 'active' ? '⏸ 停止' : '▶ 启动'}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => onEdit(task)}
                  >
                    ✏ 编辑
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => onDelete(task.id)}
                  >
                    🗑 删除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TaskList;
