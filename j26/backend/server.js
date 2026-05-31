import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const PACKAGES_DIR = path.join(__dirname, 'packages');
const ensurePackagesDir = () => {
  if (!fs.existsSync(PACKAGES_DIR)) {
    fs.mkdirSync(PACKAGES_DIR, { recursive: true });
  }
};

const AVAILABLE_PACKAGES = {
  numpy: {
    name: 'numpy',
    description: 'NumPy is the fundamental package for array computing with Python.',
    versions: [
      {
        version: '1.24.0',
        pyodideCompatible: true,
        size: '12MB',
        url: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/numpy/'
      }
    ],
    category: '科学计算'
  },
  pandas: {
    name: 'pandas',
    description: 'Powerful data structures for data analysis, time series, and statistics.',
    versions: [
      {
        version: '2.1.0',
        pyodideCompatible: true,
        size: '35MB',
        url: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pandas/'
      }
    ],
    category: '数据分析'
  },
  matplotlib: {
    name: 'matplotlib',
    description: 'Python plotting library.',
    versions: [
      {
        version: '3.7.0',
        pyodideCompatible: true,
        size: '25MB',
        url: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/matplotlib/'
      }
    ],
    category: '可视化'
  },
  scipy: {
    name: 'scipy',
    description: 'Scientific Library for Python.',
    versions: [
      {
        version: '1.11.0',
        pyodideCompatible: true,
        size: '45MB',
        url: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/scipy/'
      }
    ],
    category: '科学计算'
  },
  scikit_learn: {
    name: 'scikit-learn',
    description: 'A set of python modules for machine learning and data mining.',
    versions: [
      {
        version: '1.3.0',
        pyodideCompatible: true,
        size: '28MB',
        url: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/scikit-learn/'
      }
    ],
    category: '机器学习'
  },
  requests: {
    name: 'requests',
    description: 'Python HTTP for Humans.',
    versions: [
      {
        version: '2.31.0',
        pyodideCompatible: true,
        size: '150KB',
        url: 'pypi'
      }
    ],
    category: '网络'
  },
  beautifulsoup4: {
    name: 'beautifulsoup4',
    description: 'Screen-scraping library.',
    versions: [
      {
        version: '4.12.0',
        pyodideCompatible: true,
        size: '200KB',
        url: 'pypi'
      }
    ],
    category: '网络'
  },
  sympy: {
    name: 'sympy',
    description: 'Computer algebra system (CAS) in Python.',
    versions: [
      {
        version: '1.12',
        pyodideCompatible: true,
        size: '10MB',
        url: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/sympy/'
      }
    ],
    category: '数学'
  }
};

app.get('/api/packages', (req, res) => {
  ensurePackagesDir();
  
  const { category, search } = req.query;
  let packages = Object.values(AVAILABLE_PACKAGES);
  
  if (category) {
    packages = packages.filter(p => p.category === category);
  }
  
  if (search) {
    const searchLower = String(search).toLowerCase();
    packages = packages.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower)
    );
  }
  
  res.json({
    success: true,
    count: packages.length,
    packages
  });
});

app.get('/api/packages/:name', (req, res) => {
  const { name } = req.params;
  const pkg = AVAILABLE_PACKAGES[name];
  
  if (!pkg) {
    return res.status(404).json({
      success: false,
      error: 'Package not found'
    });
  }
  
  res.json({
    success: true,
    package: pkg
  });
});

app.get('/api/categories', (req, res) => {
  const categories = [...new Set(Object.values(AVAILABLE_PACKAGES).map(p => p.category))];
  
  res.json({
    success: true,
    categories
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    pyodideVersion: '0.25.0',
    availablePackages: Object.keys(AVAILABLE_PACKAGES).length
  });
});

app.use('/static', express.static(path.join(__dirname, 'static')));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🐍 WASM Python Debugger - Backend Service              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

🚀 Server running on: http://localhost:${PORT}

📦 Available endpoints:
   GET /api/health     - Health check
   GET /api/packages   - List all packages
   GET /api/packages/:name - Get package details
   GET /api/categories - List categories

🔧 Available packages: ${Object.keys(AVAILABLE_PACKAGES).join(', ')}

  `);
});
