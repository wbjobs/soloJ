const express = require('express');
const cors = require('cors');
const multer = require('multer');
const PDBParser = require('./pdbParser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/parse-pdb', upload.single('pdbFile'), (req, res) => {
  try {
    let pdbContent;
    
    if (req.file) {
      pdbContent = req.file.buffer.toString('utf-8');
    } else if (req.body.pdbContent) {
      pdbContent = req.body.pdbContent;
    } else {
      return res.status(400).json({ error: 'No PDB file or content provided' });
    }

    const parser = new PDBParser();
    const result = parser.parse(pdbContent);

    res.json({
      success: true,
      data: {
        atoms: result.atoms,
        bonds: result.bonds,
        residues: result.residues,
        chains: result.chains,
        secondaryStructures: result.secondaryStructures,
        stats: {
          atomCount: result.atoms.length,
          bondCount: result.bonds.length,
          residueCount: result.residues.length,
          chainCount: result.chains.length
        }
      }
    });
  } catch (error) {
    console.error('Error parsing PDB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sample-pdb/:id', (req, res) => {
  const sampleDir = path.join(__dirname, 'samples');
  const pdbId = req.params.id.toUpperCase();
  const filePath = path.join(sampleDir, `${pdbId}.pdb`);
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parser = new PDBParser();
    const result = parser.parse(content);
    
    res.json({
      success: true,
      data: {
        atoms: result.atoms,
        bonds: result.bonds,
        residues: result.residues,
        chains: result.chains,
        secondaryStructures: result.secondaryStructures,
        stats: {
          atomCount: result.atoms.length,
          bondCount: result.bonds.length,
          residueCount: result.residues.length,
          chainCount: result.chains.length
        }
      }
    });
  } else {
    res.status(404).json({ success: false, error: 'Sample PDB not found' });
  }
});

app.get('/api/samples', (req, res) => {
  const sampleDir = path.join(__dirname, 'samples');
  if (!fs.existsSync(sampleDir)) {
    return res.json({ success: true, samples: [] });
  }
  
  const files = fs.readdirSync(sampleDir)
    .filter(f => f.endsWith('.pdb'))
    .map(f => f.replace('.pdb', ''));
  
  res.json({ success: true, samples: files });
});

app.listen(PORT, () => {
  console.log(`Protein Viewer Server running at http://localhost:${PORT}`);
});
