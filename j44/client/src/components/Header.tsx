import { Link } from 'react-router-dom'

function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.container}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoIcon}>&lt;/&gt;</span>
          <span style={styles.logoText}>Code Snippet</span>
        </Link>
        <nav style={styles.nav}>
          <Link to="/" style={styles.navLink}>首页</Link>
        </nav>
      </div>
    </header>
  )
}

const styles = {
  header: {
    backgroundColor: '#252526',
    borderBottom: '1px solid #3c3c3c',
    padding: '0 24px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textDecoration: 'none',
    color: 'inherit',
  },
  logoIcon: {
    fontSize: '24px',
    color: '#007acc',
    fontWeight: 'bold' as const,
  },
  logoText: {
    fontSize: '20px',
    fontWeight: '600',
  },
  nav: {
    display: 'flex',
    gap: '20px',
  },
  navLink: {
    color: '#d4d4d4',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.2s',
  },
}

export default Header
