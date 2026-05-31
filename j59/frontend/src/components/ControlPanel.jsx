import { useState, useEffect } from 'react'
import { useStore } from '../store'
import createApi from '../services/api'

export default function ControlPanel() {
  const {
    apiBase,
    pointclouds,
    currentPointcloud,
    isSelectionMode,
    stats,
    selectionBox,
    savedSelections,
    loading,
    error,
    setPointclouds,
    setCurrentPointcloud,
    setPointcloudData,
    setOffsets,
    setSelectionMode,
    setSavedSelections,
    setLoading,
    setError,
    clearSelection,
  } = useStore()
  
  const pointSize = useStore((state) => state.pointSize)
  const colorMode = useStore((state) => state.colorMode)
  const setPointSize = useStore((state) => state.setPointSize)
  const setColorMode = useStore((state) => state.setColorMode)
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lodInfo, setLodInfo] = useState({ nodes: 0, points: 0 })
  
  const api = createApi(apiBase)
  
  useEffect(() => {
    fetchPointclouds()
    fetchSavedSelections()
  }, [apiBase])
  
  useEffect(() => {
    const interval = setInterval(() => {
      const state = useStore.getState()
      if (state.pointcloudData) {
        setLodInfo({
          nodes: state.pointcloudData.nodeCount || 0,
          points: state.pointcloudData.point_count || 0,
        })
      }
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  const fetchPointclouds = async () => {
    try {
      setLoading(true)
      const response = await api.listPointclouds()
      setPointclouds(response.data)
    } catch (err) {
      setError('Failed to load point cloud list')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  
  const fetchSavedSelections = async () => {
    try {
      const response = await api.getSelections()
      setSavedSelections(response.data)
    } catch (err) {
      console.error('Failed to load saved selections:', err)
    }
  }
  
  const handlePointcloudSelect = async (name) => {
    try {
      setLoading(true)
      setCurrentPointcloud(name)
      
      const infoResponse = await api.getPointcloudInfo(name)
      const info = infoResponse.data
      
      setOffsets({
        x: (info.bounds.min_x + info.bounds.max_x) / 2,
        y: (info.bounds.min_y + info.bounds.max_y) / 2,
        z: (info.bounds.min_z + info.bounds.max_z) / 2,
      })
      
      setPointcloudData(null)
      clearSelection()
      setLodInfo({ nodes: 0, points: 0 })
    } catch (err) {
      setError('Failed to load point cloud')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleToggleSelectionMode = () => {
    setSelectionMode(!isSelectionMode)
    if (isSelectionMode) {
      clearSelection()
    }
  }
  
  const handleSaveSelection = async () => {
    if (!stats || !selectionBox || !currentPointcloud) return
    
    try {
      setLoading(true)
      const offsets = useStore.getState().offsets
      const worldBounds = {
        min_x: selectionBox.min.x + offsets.x,
        max_x: selectionBox.max.x + offsets.x,
        min_y: selectionBox.min.y + offsets.y,
        max_y: selectionBox.max.y + offsets.y,
        min_z: selectionBox.min.z + offsets.z,
        max_z: selectionBox.max.z + offsets.z,
      }
      
      const response = await api.saveSelection({
        pointcloud_name: currentPointcloud,
        bounding_box: worldBounds,
        description,
      })
      
      setDescription('')
      clearSelection()
      await fetchSavedSelections()
      
      alert(`Selection saved! ID: ${response.data.id}`)
    } catch (err) {
      setError('Failed to save selection')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleDeleteSelection = async (id) => {
    if (!confirm('Delete this selection?')) return
    
    try {
      await api.deleteSelection(id)
      await fetchSavedSelections()
    } catch (err) {
      console.error('Failed to delete selection:', err)
    }
  }
  
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    try {
      setUploading(true)
      const response = await api.uploadPointcloud(file)
      await fetchPointclouds()
      alert(`Uploaded: ${response.data.filename}`)
    } catch (err) {
      setError('Failed to upload file')
      console.error(err)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }
  
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h2 style={styles.title}>3D 点云编辑器</h2>
      </div>
      
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>点云文件</h3>
        
        <div style={styles.uploadContainer}>
          <label style={styles.uploadLabel}>
            <input
              type="file"
              accept=".las,.laz"
              onChange={handleFileUpload}
              style={styles.fileInput}
              disabled={uploading}
            />
            {uploading ? '上传中...' : '上传 LAS/LAZ'}
          </label>
        </div>
        
        <div style={styles.listContainer}>
          {loading && <p style={styles.loading}>加载中...</p>}
          {pointclouds.length === 0 && !loading && (
            <p style={styles.empty}>暂无点云文件</p>
          )}
          {pointclouds.map((pc) => (
            <div
              key={pc.name}
              style={{
                ...styles.pointcloudItem,
                ...(currentPointcloud === pc.name ? styles.selectedItem : {}),
              }}
              onClick={() => handlePointcloudSelect(pc.name)}
            >
              <div style={styles.pcName}>{pc.name}</div>
              <div style={styles.pcInfo}>
                {pc.point_count.toLocaleString()} 点
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>渲染设置</h3>
        
        <div style={styles.controlGroup}>
          <label style={styles.label}>点大小: {pointSize.toFixed(1)}</label>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            value={pointSize}
            onChange={(e) => setPointSize(parseFloat(e.target.value))}
            style={styles.slider}
          />
        </div>
        
        <div style={styles.controlGroup}>
          <label style={styles.label}>着色模式</label>
          <select
            value={colorMode}
            onChange={(e) => setColorMode(e.target.value)}
            style={styles.select}
          >
            <option value="height">高度着色</option>
            <option value="color">原始颜色</option>
            <option value="intensity">强度</option>
            <option value="classification">分类</option>
          </select>
        </div>
      </div>
      
      {currentPointcloud && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>LOD 状态</h3>
          <div style={styles.lodInfo}>
            <div style={styles.lodItem}>
              <span style={styles.lodLabel}>已加载节点:</span>
              <span style={styles.lodValue}>{lodInfo.nodes}</span>
            </div>
            <div style={styles.lodItem}>
              <span style={styles.lodLabel}>已渲染点数:</span>
              <span style={styles.lodValue}>
                {lodInfo.points.toLocaleString()}
              </span>
            </div>
            <div style={styles.lodHint}>
              💡 基于视距动态加载 LOD 节点，有效控制显存占用
            </div>
          </div>
        </div>
      )}
      
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>选择工具</h3>
        
        <button
          style={{
            ...styles.button,
            ...(isSelectionMode ? styles.buttonActive : {}),
          }}
          onClick={handleToggleSelectionMode}
        >
          {isSelectionMode ? '🔴 关闭选择模式' : '📦 开启选择模式'}
        </button>
        
        {isSelectionMode && (
          <p style={styles.hint}>
            在 3D 视图中拖动鼠标框选区域
          </p>
        )}
        
        {selectionBox && (
          <button
            style={styles.buttonSecondary}
            onClick={clearSelection}
          >
            清除选择
          </button>
        )}
      </div>
      
      {stats && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>统计结果</h3>
          
          <div style={styles.statsGrid}>
            <div style={styles.statItem}>
              <div style={styles.statLabel}>点数量</div>
              <div style={styles.statValue}>
                {stats.point_count.toLocaleString()}
              </div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statLabel}>平均高度</div>
              <div style={styles.statValue}>
                {stats.average_height.toFixed(2)}
              </div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statLabel}>体积</div>
              <div style={styles.statValue}>
                {stats.volume.toFixed(2)}
              </div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statLabel}>高度范围</div>
              <div style={styles.statValue}>
                {stats.min_height?.toFixed(2)} - {stats.max_height?.toFixed(2)}
              </div>
            </div>
            {stats.height_std !== undefined && (
              <div style={styles.statItem}>
                <div style={styles.statLabel}>高度标准差</div>
                <div style={styles.statValue}>
                  {stats.height_std.toFixed(2)}
                </div>
              </div>
            )}
          </div>
          
          <div style={styles.controlGroup}>
            <label style={styles.label}>备注</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加备注..."
              style={styles.input}
            />
          </div>
          
          <button
            style={styles.buttonPrimary}
            onClick={handleSaveSelection}
            disabled={loading}
          >
            {loading ? '保存中...' : '💾 保存结果'}
          </button>
        </div>
      )}
      
      {savedSelections.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>已保存的结果</h3>
          <div style={styles.savedList}>
            {savedSelections.slice(0, 5).map((sel) => (
              <div key={sel.id} style={styles.savedItem}>
                <div style={styles.savedHeader}>
                  <span>#{sel.id}</span>
                  <span>{sel.pointcloud_name}</span>
                </div>
                <div style={styles.savedStats}>
                  <span>{sel.point_count.toLocaleString()} 点</span>
                  <span>高: {sel.average_height.toFixed(2)}</span>
                  <span>体: {sel.volume.toFixed(2)}</span>
                </div>
                {sel.description && (
                  <div style={styles.savedDesc}>{sel.description}</div>
                )}
                <div style={styles.savedFooter}>
                  <span style={styles.savedDate}>
                    {new Date(sel.created_at).toLocaleString()}
                  </span>
                  <button
                    style={styles.deleteButton}
                    onClick={() => handleDeleteSelection(sel.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {error && (
        <div style={styles.error}>
          {error}
          <button style={styles.closeError} onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}

const styles = {
  panel: {
    width: '320px',
    height: '100%',
    backgroundColor: '#2d2d2d',
    color: '#e0e0e0',
    overflowY: 'auto',
    overflowX: 'hidden',
    borderRight: '1px solid #444',
  },
  header: {
    padding: '16px',
    backgroundColor: '#1e88e5',
    borderBottom: '1px solid #1565c0',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
  },
  section: {
    padding: '16px',
    borderBottom: '1px solid #444',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#90caf9',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  uploadContainer: {
    marginBottom: '12px',
  },
  uploadLabel: {
    display: 'block',
    padding: '10px',
    backgroundColor: '#424242',
    borderRadius: '4px',
    textAlign: 'center',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'background-color 0.2s',
  },
  fileInput: {
    display: 'none',
  },
  listContainer: {
    maxHeight: '150px',
    overflowY: 'auto',
  },
  pointcloudItem: {
    padding: '10px 12px',
    marginBottom: '4px',
    backgroundColor: '#424242',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  selectedItem: {
    backgroundColor: '#1e88e5',
  },
  pcName: {
    fontSize: '13px',
    fontWeight: 500,
  },
  pcInfo: {
    fontSize: '11px',
    color: '#9e9e9e',
    marginTop: '2px',
  },
  controlGroup: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    marginBottom: '6px',
    color: '#bdbdbd',
  },
  slider: {
    width: '100%',
    height: '4px',
    borderRadius: '2px',
    background: '#555',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: '#424242',
    color: '#e0e0e0',
    border: '1px solid #555',
    borderRadius: '4px',
    fontSize: '13px',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: '#424242',
    color: '#e0e0e0',
    border: '1px solid #555',
    borderRadius: '4px',
    fontSize: '13px',
  },
  button: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#424242',
    color: '#e0e0e0',
    border: '1px solid #555',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonActive: {
    backgroundColor: '#e53935',
    borderColor: '#c62828',
  },
  buttonSecondary: {
    width: '100%',
    marginTop: '8px',
    padding: '8px',
    backgroundColor: 'transparent',
    color: '#90caf9',
    border: '1px solid #90caf9',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  buttonPrimary: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#43a047',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  },
  hint: {
    fontSize: '11px',
    color: '#90caf9',
    marginTop: '8px',
    textAlign: 'center',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '12px',
  },
  statItem: {
    backgroundColor: '#424242',
    padding: '10px',
    borderRadius: '4px',
  },
  statLabel: {
    fontSize: '10px',
    color: '#9e9e9e',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: 600,
    marginTop: '2px',
  },
  savedList: {
    maxHeight: '200px',
    overflowY: 'auto',
  },
  savedItem: {
    backgroundColor: '#424242',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '12px',
  },
  savedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 600,
    marginBottom: '4px',
  },
  savedStats: {
    display: 'flex',
    gap: '10px',
    fontSize: '11px',
    color: '#bdbdbd',
  },
  savedDesc: {
    fontSize: '11px',
    color: '#90caf9',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  savedFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: '1px solid #555',
  },
  savedDate: {
    fontSize: '10px',
    color: '#757575',
  },
  deleteButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#e57373',
    border: '1px solid #e57373',
    borderRadius: '3px',
    fontSize: '10px',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    color: '#9e9e9e',
    fontSize: '13px',
  },
  empty: {
    textAlign: 'center',
    color: '#757575',
    fontSize: '12px',
    padding: '20px',
  },
  error: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    right: '16px',
    padding: '12px 16px',
    backgroundColor: '#c62828',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '13px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeError: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  lodInfo: {
    backgroundColor: '#1e3a5f',
    padding: '12px',
    borderRadius: '4px',
    border: '1px solid #2e5a8f',
  },
  lodItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  lodLabel: {
    fontSize: '12px',
    color: '#90caf9',
  },
  lodValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
  },
  lodHint: {
    fontSize: '10px',
    color: '#64b5f6',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #2e5a8f',
    lineHeight: 1.4,
  },
}
