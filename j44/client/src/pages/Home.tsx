import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const languages = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
]

function Home() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [isLoading, setIsLoading] = useState(false)

  const handleCreateSnippet = async () => {
    setIsLoading(true)
    try {
      const response = await axios.post('/api/snippets', {
        title: title || '未命名代码片段',
        language,
      })
      navigate(`/s/${response.data.id}`)
    } catch (error) {
      console.error('创建代码片段失败:', error)
      const mockId = Math.random().toString(36).substring(2, 10)
      navigate(`/s/${mockId}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>创建新的代码片段</h1>
        <p style={styles.subtitle}>与他人实时协作编辑代码</p>

        <div style={styles.formGroup}>
          <label style={styles.label}>代码片段标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入代码片段标题..."
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>选择编程语言</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={styles.select}
          >
            {languages.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCreateSnippet}
          disabled={isLoading}
          style={isLoading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
        >
          {isLoading ? '创建中...' : '创建新代码片段'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: 'calc(100vh - 60px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  card: {
    backgroundColor: '#252526',
    borderRadius: '12px',
    padding: '48px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    border: '1px solid #3c3c3c',
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#ffffff',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '32px',
    textAlign: 'center' as const,
  },
  formGroup: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#d4d4d4',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: '6px',
    color: '#d4d4d4',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    backgroundColor: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: '6px',
    color: '#d4d4d4',
    outline: 'none',
    cursor: 'pointer',
  },
  button: {
    width: '100%',
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#007acc',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginTop: '8px',
  },
  buttonDisabled: {
    backgroundColor: '#005a9e',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
}

export default Home
