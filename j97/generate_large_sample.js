const fs = require('fs');
const path = require('path');

function generateLargePDB(filename, atomCount) {
    const residues = ['ALA', 'ARG', 'ASN', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE', 'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL'];
    const elements = ['C', 'H', 'O', 'N', 'S', 'P'];
    const chains = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    
    let pdbContent = `HEADER    LARGE PROTEIN COMPLEX FOR PERFORMANCE TEST
TITLE     Synthetic Protein - ${atomCount} atoms
`;
    
    let seqRes = [];
    for (let i = 0; i < Math.floor(atomCount / 10); i++) {
        seqRes.push(residues[i % residues.length]);
    }
    
    const seqPerLine = 15;
    for (let i = 0; i < seqRes.length; i += seqPerLine) {
        const chunk = seqRes.slice(i, i + seqPerLine);
        pdbContent += `SEQRES   ${Math.floor(i/seqPerLine)+1} A ${seqRes.length}  ${chunk.join(' ')}\n`;
    }
    
    let atomSerial = 1;
    let residueSeq = 1;
    const atomsPerResidue = 10;
    
    for (let r = 0; r < Math.floor(atomCount / atomsPerResidue); r++) {
        const residueName = seqRes[r % seqRes.length];
        const chainId = chains[Math.floor(r / 100) % chains.length];
        const angle = r * 0.5;
        const radius = 10 + Math.sin(r * 0.1) * 5;
        const z = r * 0.3;
        
        const baseX = Math.cos(angle) * radius;
        const baseY = Math.sin(angle) * radius;
        const baseZ = z;
        
        const atomNames = ['N', 'CA', 'C', 'O', 'CB', 'CG', 'CD', 'CE', 'CG1', 'CG2'];
        for (let a = 0; a < Math.min(atomsPerResidue, atomNames.length); a++) {
            if (atomSerial > atomCount) break;
            
            const atomName = atomNames[a];
            let element = 'C';
            if (atomName === 'N') element = 'N';
            else if (atomName === 'O') element = 'O';
            else if (atomName.startsWith('H')) element = 'H';
            else if (atomName === 'S') element = 'S';
            
            const offsetX = Math.sin(a * 1.5) * 0.8;
            const offsetY = Math.cos(a * 1.5) * 0.8;
            const offsetZ = a * 0.3;
            
            const x = (baseX + offsetX).toFixed(3);
            const y = (baseY + offsetY).toFixed(3);
            const zCoord = (baseZ + offsetZ).toFixed(3);
            
            pdbContent += `ATOM  ${String(atomSerial).padStart(5)}  ${atomName.padEnd(4)}${residueName} ${chainId}${String(residueSeq).padStart(4)}    ${x.padStart(8)}${y.padStart(8)}${zCoord.padStart(8)}  1.00 20.00          ${element.padStart(2)}  \n`;
            
            atomSerial++;
        }
        residueSeq++;
    }
    
    for (let i = 1; i < atomSerial - 1; i += 2) {
        pdbContent += `CONECT${String(i).padStart(5)}${String(i+1).padStart(5)}\n`;
    }
    
    pdbContent += 'END\n';
    
    const samplesDir = path.join(__dirname, 'samples');
    if (!fs.existsSync(samplesDir)) {
        fs.mkdirSync(samplesDir, { recursive: true });
    }
    
    const filePath = path.join(samplesDir, `${filename}.pdb`);
    fs.writeFileSync(filePath, pdbContent);
    
    console.log(`Generated ${filename}.pdb with ${atomSerial - 1} atoms`);
}

const testSizes = [
    { name: 'LARGE1', atoms: 5000 },
    { name: 'LARGE2', atoms: 20000 },
    { name: 'LARGE3', atoms: 50000 },
];

testSizes.forEach(test => {
    generateLargePDB(test.name, test.atoms);
});

console.log('\nSample PDB files generated for performance testing.');
console.log('Load them in the viewer to test performance optimizations!');
