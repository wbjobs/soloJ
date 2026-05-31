import { useState, useEffect } from 'react'
import { useStore } from '../store'
import createApi from '../services/api'

export default function ClassificationLegend() {
  const {
    apiBase,
    classificationRules,
    visibleClasses,
    currentPointcloud,
    classificationStats,
    setClassificationRules,
    toggleClassVisibility,
    setClassificationStats,
  } = useStore()
  
  const [isExpanded, setIsExpanded] = useState(true)
  const [classifyMethod, setClassifyMethod] = useState('rgb')
  const [isClassifying, setIsClassifying] = useState(false)
  
  const api = createApi(apiBase)
  
  useEffect(() => {
    if (classificationRules.length === 0) {
      api.getClassificationRules()
        .then(response => {
          setClassificationRules(response.data.rules)
        })
        .catch(error => {
          console.error('Failed to load classification rules:', error)
        })
    }
  }, [api, classificationRules.length, setClassificationRules])
  
  const handleClassify = async () => {
    if (!currentPointcloud) return
    
    try {
      setIsClassifying(true)
      const response = await api.classifyPointcloud(currentPointcloud, classifyMethod)
      setClassificationStats(response.data.statistics)
    } catch (error) {
      console.error('Failed to classify point cloud:', error)
    } finally {
      setIsClassifying(false)
    }
  }
  
  const getClassStats = (classId) => {
    if (!classificationStats?.classes) return null
    return classificationStats.classes.find(c => c.class_id === classId)
  }
  
  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <span style={styles.title}>🏷️ 分类图例</span>
        <span style={styles.expandIcon}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      
      {isExpanded && (
        <>
          <div style={styles.classifyControls}>
            <select
              value={classifyMethod}
              onChange={(e) => setClassifyMethod(e.target.value)}
              style={styles.select}
              disabled={!currentPointcloud || isClassifying}
            >
              <option value="rgb">RGB 颜色分类</option>
              <option value="intensity">反射强度分类</option>
            </select>
            <button
              style={styles.classifyButton}
              onClick={handleClassify}
              disabled={!currentPointcloud || isClassifying}
            >
              {isClassifying ? '分类中...' : '执行分类'}
            </button>
          </div>
          
          <div style={styles.legendList}>
            {classificationRules.map((rule) => {
              const stats = getClassStats(rule.class_id)
              const isVisible = visibleClasses.has(rule.class_id)
              
              return (
                <div
                  key={rule.class_id}
                  style={{
                    ...styles.legendItem,
                    opacity: isVisible ? 1 : 0.4,
                  }}
                >
                  <div
                    style={{
                      ...styles.colorSwatch,
                      backgroundColor: `rgb(${rule.color.join(',')})`,
                    }}
                    onClick={() => toggleClassVisibility(rule.class_id)}
                  />
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleClassVisibility(rule.class_id)}
                      style={styles.checkbox}
                    />
                    <span style={styles.className}>{rule.name}</span>
                  </label>
                  {stats && (
                    <span style={styles.classStats}>
                      {(stats.percentage).toFixed(1)}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          
          {classificationStats && (
            <div style={styles.statsInfo}>
              <div style={styles.statsTitle}>分类统计</div>
              <div style={styles.statsRow}>
                <span>总点数:</span>
                <span>{classificationStats.total_points?.toLocaleString()}</span>
              </div>
              <div style={styles.statsRow}>
                <span>分类数:</span>
                <span>{classificationStats.classes?.length || 0}</span>
              </div>
            </div>
          )}
          
          <div style={styles.hint}>
            💡 勾选/取消勾选可控制分类显示
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  container: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    backgroundColor: 'rgba(45, 45, 45, 0.95)',
    borderRadius: '8px',
    border: '1px solid #555',
    minWidth: '220px',
    maxWidth: '280px',
    zIndex: 1000,
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  header: {
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    borderBottom: '1px solid #555',
    backgroundColor: '#1e88e5',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
  },
  expandIcon: {
    fontSize: '12px',
    color: '#fff',
  },
  classifyControls: {
    padding: '12px 14px',
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid #444',
  },
  select: {
    flex: 1,
    padding: '6px 8px',
    backgroundColor: '#424242',
    color: '#e0e0e0',
    border: '1px solid #555',
    borderRadius: '4px',
    fontSize: '12px',
  },
  classifyButton: {
    padding: '6px 12px',
    backgroundColor: '#43a047',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  legendList: {
    padding: '8px 10px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 4px',
    gap: '8px',
    transition: 'opacity 0.2s',
  },
  colorSwatch: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.3)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    cursor: 'pointer',
    fontSize: '13px',
  },
  checkbox: {
    marginRight: '8px',
    cursor: 'pointer',
  },
  className: {
    fontSize: '13px',
  },
  classStats: {
    fontSize: '11px',
    color: '#90caf9',
    marginLeft: 'auto',
  },
  statsInfo: {
    padding: '10px 14px',
    borderTop: '1px solid #444',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  statsTitle: {
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#90caf9',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    marginBottom: '4px',
  },
  hint: {
    padding: '8px 14px',
    fontSize: '11px',
    color: '#757575',
    borderTop: '1px solid #444',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
}
