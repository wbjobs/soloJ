import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import TaskList from './components/TaskList.jsx';
import TaskForm from './components/TaskForm.jsx';
import ExecutionLogs from './components/ExecutionLogs.jsx';
import Stats from './components/Stats.jsx';
import DAGVisualization from './components/DAGVisualization.jsx';

const API_URL = '/api';

function App() {
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showDAG, setShowDAG] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/tasks`);
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/tasks/logs?limit=20`);
      setLogs(response.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }, []);

  const fetchGraph = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/tasks/graph`);
      setGraph(response.data);
    } catch (error) {
      console.error('Failed to fetch graph:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTasks(), fetchLogs(), fetchGraph()]);
      setLoading(false);
    };
    loadData();
  }, [fetchTasks, fetchLogs, fetchGraph]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTasks();
      fetchLogs();
      fetchGraph();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks, fetchLogs, fetchGraph]);

  const handleCreateTask = async (taskData) => {
    try {
      await axios.post(`${API_URL}/tasks`, taskData);
      await fetchTasks();
      await fetchGraph();
      setShowForm(false);
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('创建任务失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdateTask = async (taskId, taskData) => {
    try {
      await axios.put(`${API_URL}/tasks/${taskId}`, taskData);
      await fetchTasks();
      await fetchGraph();
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('更新任务失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('确定要删除这个任务吗？')) {
      try {
        await axios.delete(`${API_URL}/tasks/${taskId}`);
        await fetchTasks();
        await fetchGraph();
      } catch (error) {
        console.error('Failed to delete task:', error);
        alert('删除任务失败: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const newStatus = task.status === 'active' ? 'inactive' : 'active';
      await axios.put(`${API_URL}/tasks/${task.id}`, { status: newStatus });
      await fetchTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>分布式 Cron 任务调度系统</h1>
        <p>基于 Redis 分布式锁的任务调度中心</p>
      </header>

      <main className="main-content">
        <Stats tasks={tasks} logs={logs} />

        <DAGVisualization graph={graph} visible={showDAG} onToggle={() => setShowDAG(!showDAG)} />

        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>任务管理</h2>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              + 新建任务
            </button>
          </div>

          {showForm && (
            <TaskForm
              allTasks={tasks}
              onSubmit={handleCreateTask}
              onCancel={() => setShowForm(false)}
            />
          )}

          <TaskList
            tasks={tasks}
            onEdit={(task) => setEditingTask(task)}
            onDelete={handleDeleteTask}
            onToggle={handleToggleTask}
          />

          {editingTask && (
            <div className="modal-overlay">
              <div className="modal">
                <div className="modal-header">
                  <h3>编辑任务</h3>
                  <button className="close-btn" onClick={() => setEditingTask(null)}>
                    &times;
                  </button>
                </div>
                <TaskForm
                  task={editingTask}
                  allTasks={tasks}
                  onSubmit={(data) => handleUpdateTask(editingTask.id, data)}
                  onCancel={() => setEditingTask(null)}
                />
              </div>
            </div>
          )}
        </div>

        <ExecutionLogs logs={logs} />
      </main>
    </div>
  );
}

export default App;
