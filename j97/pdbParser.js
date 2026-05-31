class PDBParser {
  constructor() {
    this.atoms = [];
    this.bonds = [];
    this.residues = [];
    this.chains = [];
    this.secondaryStructures = [];
  }

  parse(pdbContent) {
    const lines = pdbContent.split('\n');
    
    for (let line of lines) {
      const recordType = line.substring(0, 6).trim();
      
      switch (recordType) {
        case 'ATOM':
        case 'HETATM':
          this.parseAtom(line);
          break;
        case 'CONECT':
          this.parseConect(line);
          break;
        case 'SHEET':
          this.parseSheet(line);
          break;
        case 'HELIX':
          this.parseHelix(line);
          break;
        case 'SEQRES':
          this.parseSeqres(line);
          break;
      }
    }

    this.inferBonds();
    this.groupResidues();
    
    return {
      atoms: this.atoms,
      bonds: this.bonds,
      residues: this.residues,
      chains: this.chains,
      secondaryStructures: this.secondaryStructures
    };
  }

  parseAtom(line) {
    const atom = {
      serial: parseInt(line.substring(6, 11).trim()),
      name: line.substring(12, 16).trim(),
      altLoc: line.substring(16, 17).trim(),
      residueName: line.substring(17, 20).trim(),
      chainId: line.substring(21, 22).trim(),
      residueSeq: parseInt(line.substring(22, 26).trim()),
      iCode: line.substring(26, 27).trim(),
      x: parseFloat(line.substring(30, 38).trim()),
      y: parseFloat(line.substring(38, 46).trim()),
      z: parseFloat(line.substring(46, 54).trim()),
      occupancy: parseFloat(line.substring(54, 60).trim()),
      tempFactor: parseFloat(line.substring(60, 66).trim()),
      element: line.substring(76, 78).trim() || this.inferElement(line.substring(12, 16).trim()),
      charge: line.substring(78, 80).trim()
    };
    
    if (!atom.altLoc) {
      this.atoms.push(atom);
    }
  }

  inferElement(atomName) {
    const firstChar = atomName.charAt(0);
    if ('CHONSP'.includes(firstChar)) {
      return firstChar;
    }
    return 'C';
  }

  parseConect(line) {
    const atom1 = parseInt(line.substring(6, 11).trim());
    const bondedAtoms = [];
    
    for (let i = 0; i < 4; i++) {
      const start = 11 + i * 5;
      const end = start + 5;
      if (end <= line.length) {
        const atomSerial = parseInt(line.substring(start, end).trim());
        if (atomSerial) {
          bondedAtoms.push(atomSerial);
        }
      }
    }

    for (const atom2 of bondedAtoms) {
      if (atom1 < atom2) {
        this.bonds.push({ from: atom1, to: atom2 });
      }
    }
  }

  parseSheet(line) {
    const sheet = {
      type: 'sheet',
      strand: parseInt(line.substring(7, 10).trim()),
      sheetId: line.substring(11, 14).trim(),
      numStrands: parseInt(line.substring(14, 16).trim()),
      startResidue: {
        name: line.substring(17, 20).trim(),
        chainId: line.substring(21, 22).trim(),
        seq: parseInt(line.substring(22, 26).trim())
      },
      endResidue: {
        name: line.substring(28, 31).trim(),
        chainId: line.substring(32, 33).trim(),
        seq: parseInt(line.substring(33, 37).trim())
      },
      sense: parseInt(line.substring(38, 40).trim())
    };
    this.secondaryStructures.push(sheet);
  }

  parseHelix(line) {
    const helix = {
      type: 'helix',
      serial: parseInt(line.substring(7, 10).trim()),
      helixId: line.substring(11, 14).trim(),
      startResidue: {
        name: line.substring(15, 18).trim(),
        chainId: line.substring(19, 20).trim(),
        seq: parseInt(line.substring(21, 25).trim())
      },
      endResidue: {
        name: line.substring(27, 30).trim(),
        chainId: line.substring(31, 32).trim(),
        seq: parseInt(line.substring(33, 37).trim())
      },
      helixClass: line.substring(38, 40).trim(),
      length: parseInt(line.substring(71, 76).trim())
    };
    this.secondaryStructures.push(helix);
  }

  parseSeqres(line) {
    const chainId = line.substring(11, 12).trim();
    const residues = line.substring(19, 70).trim().split(/\s+/);
    
    let chain = this.chains.find(c => c.id === chainId);
    if (!chain) {
      chain = { id: chainId, residues: [] };
      this.chains.push(chain);
    }
    chain.residues.push(...residues);
  }

  inferBonds() {
    if (this.bonds.length > 0) return;
    
    const atomMap = new Map();
    this.atoms.forEach(atom => {
      atomMap.set(atom.serial, atom);
    });

    const bondThreshold = 1.9;
    
    for (let i = 0; i < this.atoms.length; i++) {
      for (let j = i + 1; j < this.atoms.length; j++) {
        const atom1 = this.atoms[i];
        const atom2 = this.atoms[j];
        
        if (atom1.chainId !== atom2.chainId) continue;
        if (Math.abs(atom1.residueSeq - atom2.residueSeq) > 1) continue;
        
        const dx = atom1.x - atom2.x;
        const dy = atom1.y - atom2.y;
        const dz = atom1.z - atom2.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance < bondThreshold && distance > 0.4) {
          this.bonds.push({ from: atom1.serial, to: atom2.serial });
        }
      }
    }
  }

  groupResidues() {
    const residueMap = new Map();
    
    this.atoms.forEach(atom => {
      const key = `${atom.chainId}-${atom.residueSeq}`;
      if (!residueMap.has(key)) {
        residueMap.set(key, {
          chainId: atom.chainId,
          seq: atom.residueSeq,
          name: atom.residueName,
          atoms: []
        });
      }
      residueMap.get(key).atoms.push(atom);
    });
    
    this.residues = Array.from(residueMap.values());
    
    this.residues.forEach(residue => {
      const ca = residue.atoms.find(a => a.name === 'CA');
      if (ca) {
        residue.ca = ca;
      }
    });
  }
}

module.exports = PDBParser;
