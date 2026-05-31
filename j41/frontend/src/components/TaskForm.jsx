import React, { useState, useEffect } from 'react';

function TaskForm({ task, onSubmit, onCancel, allTasks = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    cronExpression: '',
    command: '',
    timeout: 30,
    status: 'active',
    dependsOn: [],
  });

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        cronExpression: task.cronExpression,
        command: task.command,
        timeout: task.timeout,
        status: task.status,
        dependsOn: task.dependsOn || [],
      });
    }
  }, [task]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'timeout' ? parseInt(value) : value,
    }));
  };

  const handleDependencyChange = (e) => {
    const options = e.target.options;
    const selected = [];
    for (let i = 0; i < options.length; i++) {
      if (options[i].selected && options[i].value !== '') {
        selected.push(options[i].value);
      }
    }
    setFormData((prev) => ({ ...prev, dependsOn: selected }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const cronExamples = [
    { label: '每分钟', value: '* * * * *' },
    { label: '每5分钟', value: '*/5 * * * *' },
    { label: '每小时', value: '0 * * * *' },
    { label: '每天 0 点', value: '0 0 * * *' },
    { label: '每周一 9 点', value: '0 9 * * 1' },
    { label: '每秒 (扩展)', value: '* * * * * *' },
  ];

  const availableTasks = allTasks.filter(t => t.id !== task?.id);

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
      <div className="task-form">
        <div className="form-group">
          <label>任务名称 *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="例如：每日备份任务"
            required
          />
        </div>

        <div className="form-group">
          <label>Cron 表达式 *</label>
          <input
            type="text"
            name="cronExpression"
            value={formData.cronExpression}
            onChange={handleChange}
            placeholder="例如：* * * * *"
            required
          />
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {cronExamples.map((example) => (
              <button
                key={example.value}
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                onClick={() => setFormData((prev) => ({ ...prev, cronExpression: example.value }))}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>超时时间 (秒)</label>
          <input
            type="number"
            name="timeout"
            value={formData.timeout}
            onChange={handleChange}
            min="1"
            max="3600"
          />
        </div>

        {task && (
          <div className="form-group">
            <label>状态</label>
            <select name="status" value={formData.status} onChange={handleChange}>
              <option value="active">运行中</option>
              <option value="inactive">已停止</option>
            </select>
          </div>
        )}

        <div className="form-group full-width">
          <label>前置依赖任务（按住 Ctrl 多选）</label>
          <select
            multiple
            name="dependsOn"
            value={formData.dependsOn}
            onChange={handleDependencyChange}
            style={{ minHeight: '100px' }}
          >
            <option value="">无依赖</option>
            {availableTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <small style={{ color: '#718096' }}>
            只有当前置任务执行成功时，当前任务才会被执行
          </small>
        </div>

        <div className="form-group full-width">
          <label>执行命令 *</label>
          <textarea
            name="command"
            value={formData.command}
            onChange={handleChange}
            placeholder="例如：echo 'Hello World'"
            rows="3"
            required
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="btn btn-primary">
          {task ? '保存修改' : '创建任务'}
        </button>
      </div>
    </form>
  );
}

export default TaskForm;
