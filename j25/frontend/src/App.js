import React, { useState, useEffect, useCallback, useRef } from 'react';

const SAMPLE_SCENE = {
  width: 256,
  height: 256,
  samplesPerPixel: 4,
  camera: {
    position: { x: 0, y: 2, z: 5 },
    lookAt: { x: 0, y: 0, z: 0 },
    fov: 60
  },
  spheres: [
    {
      center: { x: 0, y: -1000.5, z: -1 },
      radius: 1000,
      color: { x: 0.8, y: 0.8, z: 0.8 },
      reflection: 0
    },
    {
      center: { x: 0, y: 0, z: -1 },
      radius: 0.5,
      color: { x: 0.9, y: 0.3, z: 0.3 },
      reflection: 0.3
    },
    {
      center: { x: -1.2, y: -0.2, z: -0.8 },
      radius: 0.3,
      color: { x: 0.3, y: 0.9, z: 0.3 },
      reflection: 0.5
    },
    {
      center: { x: 1.2, y: -0.2, z: -0.8 },
      radius: 0.3,
      color: { x: 0.3, y: 0.3, z: 0.9 },
      reflection: 0.7
    }
  ],
  cubes: [
    {
      min: { x: 0.5, y: -0.5, z: 0 },
      max: { x: 1.5, y: 0.5, z: -1 },
      color: { x: 0.8, y: 0.8, z: 0.3 },
      reflection: 0.2
    }
  ],
  lights: [
    {
      position: { x: 5, y: 5, z: 5 },
      color: { x: 1, y: 1, z: 1 },
      intensity: 1
    },
    {
      position: { x: -3, y: 3, z: -2 },
      color: { x: 0.5, y: 0.5, z: 0.8 },
      intensity: 0.5
    }
  ]
};

function App() {
  const [tasks, setTasks] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [sceneJson, setSceneJson] = useState(JSON.stringify(SAMPLE_SCENE, null, 2));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [sampleMapImage, setSampleMapImage] = useState(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [previewStats, setPreviewStats] = useState(null);

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'statusUpdate') {
          setTasks(data.tasks || []);
          setWorkers(data.workers || []);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      setWsConnected(false);
      setTimeout(connectWebSocket, 3000);
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connectWebSocket();
    return () => {
      if (ws) ws.close();
    };
  }, [connectWebSocket]);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const scene = JSON.parse(sceneJson);
      
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scene),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(`Task created: ${data.taskId}`);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to create task');
      }
    } catch (err) {
      setError('Invalid JSON or server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePreview = async () => {
    setError('');
    setGeneratingPreview(true);
    setPreviewImage(null);
    setSampleMapImage(null);
    setPreviewStats(null);

    try {
      const scene = JSON.parse(sceneJson);
      
      const response = await fetch('/api/preview/adaptive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scene),
      });

      const data = await response.json();
      
      if (response.ok) {
        setPreviewImage(data.previewUrl + '?t=' + Date.now());
        setSampleMapImage(data.sampleMapUrl + '?t=' + Date.now());
        setPreviewStats({
          totalSamples: data.totalSamples,
          renderTimeMs: data.renderTimeMs,
          width: data.width,
          height: data.height
        });
      } else {
        setError(data.error || 'Failed to generate preview');
      }
    } catch (err) {
      setError('Invalid JSON or server error');
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleDownload = async (taskId) => {
    window.open(`/api/tasks/${taskId}/download`, '_blank');
  };

  const handleExportStats = async (taskId) => {
    window.open(`/api/tasks/${taskId}/export-stats`, '_blank');
  };

  const loadSampleScene = () => {
    setSceneJson(JSON.stringify(SAMPLE_SCENE, null, 2));
    setPreviewImage(null);
    setSampleMapImage(null);
    setPreviewStats(null);
  };

  const activeWorkers = workers.filter(w => w.status === 'active').length;
  const runningTasks = tasks.filter(t => t.status === 'running').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;

  return (
    <div className="app">
      <div className="header">
        <h1>🎬 Ray Tracing Render Farm</h1>
        <p>
          Distributed rendering system with gRPC task distribution •{' '}
          <span style={{ color: wsConnected ? '#4caf50' : '#f44336' }}>
            {wsConnected ? '● Connected' : '○ Disconnected'}
          </span>
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{activeWorkers}</div>
          <div className="stat-label">Active Workers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{runningTasks}</div>
          <div className="stat-label">Running Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{pendingTasks}</div>
          <div className="stat-label">Pending Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completedTasks}</div>
          <div className="stat-label">Completed Tasks</div>
        </div>
      </div>

      <div className="main-grid">
        <div className="card">
          <h2>📤 Submit Render Task</h2>
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button className="sample-scene-btn" onClick={loadSampleScene}>
              Load Sample Scene
            </button>
            <button 
              className="sample-scene-btn" 
              onClick={handleGeneratePreview}
              disabled={generatingPreview}
              style={{ background: generatingPreview ? '#666' : '#2a5a8a' }}
            >
              {generatingPreview ? 'Generating...' : '🎨 Adaptive Preview'}
            </button>
          </div>
          
          <div className="form-group">
            <label>Scene Description (JSON)</label>
            <textarea
              value={sceneJson}
              onChange={(e) => setSceneJson(e.target.value)}
              placeholder="Paste your scene JSON here..."
              style={{ minHeight: '150px' }}
            />
          </div>
          
          <button
            className="btn"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Render Task'}
          </button>
          
          {previewImage && (
            <div style={{ marginTop: '20px' }}>
              <h3 style={{ color: '#e94560', marginBottom: '10px' }}>Adaptive Preview</h3>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#a0a0a0', marginBottom: '5px' }}>Rendered Image</p>
                  <img 
                    src={previewImage} 
                    alt="Preview" 
                    style={{ 
                      width: '100%', 
                      maxWidth: '256px',
                      borderRadius: '8px',
                      border: '1px solid #1a4a7a'
                    }} 
                  />
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#a0a0a0', marginBottom: '5px' }}>Sample Heatmap (Red = More Samples)</p>
                  <img 
                    src={sampleMapImage} 
                    alt="Sample Map" 
                    style={{ 
                      width: '100%', 
                      maxWidth: '256px',
                      borderRadius: '8px',
                      border: '1px solid #1a4a7a'
                    }} 
                  />
                </div>
              </div>
              {previewStats && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#b0b0b0' }}>
                  <span>Resolution: {previewStats.width}×{previewStats.height}</span>
                  <span style={{ margin: '0 10px' }}>|</span>
                  <span>Samples: {(previewStats.totalSamples / 1000000).toFixed(2)}M</span>
                  <span style={{ margin: '0 10px' }}>|</span>
                  <span>Time: {previewStats.renderTimeMs}ms</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2>🔧 Worker Nodes ({workers.length})</h2>
          {workers.length === 0 ? (
            <p style={{ color: '#a0a0a0', textAlign: 'center', padding: '20px' }}>
              No workers connected
            </p>
          ) : (
            <div className="worker-list">
              {workers.map((worker) => (
                <div key={worker.workerId} className={`worker-card ${worker.status}`}>
                  <div className="worker-id">{worker.workerId}</div>
                  <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                    <span className={`worker-status ${worker.status}`}></span>
                    {worker.status}
                  </div>
                  <div className="worker-info">
                    <div>Cores: {worker.cores}</div>
                    <div>Load: {worker.currentLoad}</div>
                    {worker.currentTaskId && (
                      <div style={{ marginTop: '4px', color: '#e94560' }}>
                        Task: {worker.currentTaskId.slice(0, 8)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>📋 Render Tasks</h2>
        {tasks.length === 0 ? (
          <p style={{ color: '#a0a0a0', textAlign: 'center', padding: '40px' }}>
            No tasks yet. Submit a scene to start rendering!
          </p>
        ) : (
          <div className="task-list">
            {tasks.slice().reverse().map((task) => (
              <div key={task.taskId} className={`task-item ${task.status}`}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  {task.previewUrl && (
                    <div style={{ flexShrink: 0 }}>
                      <img 
                        src={task.previewUrl + '?t=' + task.createdAt} 
                        alt="Preview"
                        style={{ 
                          width: '64px', 
                          height: '64px', 
                          objectFit: 'cover',
                          borderRadius: '6px',
                          border: '1px solid #1a4a7a'
                        }} 
                      />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div className="task-header">
                      <span className="task-id">{task.taskId}</span>
                      <span className={`task-status ${task.status}`}>
                        {task.status}
                      </span>
                    </div>
                    
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                    
                    <div className="task-info">
                      <span>{task.completedBlocks}/{task.totalBlocks} blocks</span>
                      <span>{task.progress.toFixed(1)}%</span>
                      <span>{task.width}×{task.height}</span>
                      <span>{task.samplesPerPixel} spp</span>
                      {task.totalSamples && (
                        <span>{(task.totalSamples / 1000000).toFixed(1)}M samples</span>
                      )}
                      {task.etaFormatted && task.status === 'running' && (
                        <span style={{ color: '#ff9800' }}>ETA: {task.etaFormatted}</span>
                      )}
                    </div>
                    
                    {task.status === 'completed' && (
                      <div className="task-actions">
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleDownload(task.taskId)}
                        >
                          Download PNG
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleExportStats(task.taskId)}
                        >
                          Export Stats
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
