import Scene from './components/Scene.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import ClassificationLegend from './components/ClassificationLegend.jsx'
import { useStore } from './store'

export default function App() {
  const { currentPointcloud, offsets, pointSize, colorMode } = useStore()
  
  return (
    <div style={styles.container}>
      <ControlPanel />
      <div style={styles.viewer}>
        <Scene
          currentPointcloud={currentPointcloud}
          offsets={offsets}
          pointSize={pointSize}
          colorMode={colorMode}
        />
        <ClassificationLegend />
      </div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    overflow: 'hidden',
  },
  viewer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
}
