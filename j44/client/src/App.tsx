import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import SnippetEditor from './pages/SnippetEditor'

function App() {
  return (
    <div className="app">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/s/:id" element={<SnippetEditor />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
