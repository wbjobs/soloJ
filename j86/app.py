from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from rdkit import Chem
from rdkit.Chem import Descriptors, AllChem, rdMolDescriptors
import numpy as np
import os
import logging
import json
import time

app = Flask(__name__)
CORS(app)

logger = logging.getLogger(__name__)

VALID_ELEMENTS = {'H', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Br', 'I'}

ATOMIC_RADII = {
    'H': 0.37,
    'C': 0.77,
    'N': 0.75,
    'O': 0.73,
    'F': 0.71,
    'P': 1.06,
    'S': 1.02,
    'Cl': 0.99,
    'Br': 1.14,
    'I': 1.33
}

BOND_LENGTHS = {
    ('C', 'C'): 1.54,
    ('C', 'H'): 1.09,
    ('C', 'N'): 1.47,
    ('C', 'O'): 1.43,
    ('C', 'F'): 1.35,
    ('C', 'Cl'): 1.77,
    ('C', 'Br'): 1.94,
    ('C', 'I'): 2.14,
    ('C', 'S'): 1.82,
    ('C', 'P'): 1.84,
    ('N', 'H'): 1.01,
    ('N', 'N'): 1.45,
    ('N', 'O'): 1.40,
    ('O', 'H'): 0.96,
    ('O', 'O'): 1.48,
    ('F', 'H'): 0.92,
    ('S', 'H'): 1.35,
    ('P', 'H'): 1.42,
    ('S', 'O'): 1.51,
    ('P', 'O'): 1.63,
    ('Cl', 'H'): 1.27,
    ('Br', 'H'): 1.41,
    ('I', 'H'): 1.61
}

def get_bond_length(atom1, atom2):
    key = tuple(sorted([atom1, atom2]))
    return BOND_LENGTHS.get(key, 1.5)

def calculate_bonds(atoms):
    bonds = []
    for i in range(len(atoms)):
        for j in range(i + 1, len(atoms)):
            a1 = atoms[i]
            a2 = atoms[j]
            dist = np.sqrt(
                (a1['x'] - a2['x'])**2 +
                (a1['y'] - a2['y'])**2 +
                (a1['z'] - a2['z'])**2
            )
            bond_len = get_bond_length(a1['element'], a2['element'])
            if dist < bond_len * 1.3:
                bonds.append((i, j))
    return bonds

def build_molecule_from_atoms(atoms, bonds):
    mol = Chem.RWMol()
    
    atom_indices = []
    for atom in atoms:
        rdkit_atom = Chem.Atom(atom['element'])
        idx = mol.AddAtom(rdkit_atom)
        atom_indices.append(idx)
    
    for (i, j) in bonds:
        mol.AddBond(atom_indices[i], atom_indices[j], Chem.BondType.SINGLE)
    
    sanitize_failed = False
    sanitize_error = ''
    try:
        Chem.SanitizeMol(mol)
    except Chem.AtomValenceException as e:
        sanitize_failed = True
        sanitize_error = f'价键异常: {str(e)}'
        logger.warning(f'AtomValenceException: {e}')
    except Chem.KekulizeException as e:
        sanitize_failed = True
        sanitize_error = f'芳香性求解失败: {str(e)}'
        logger.warning(f'KekulizeException: {e}')
    except Exception as e:
        sanitize_failed = True
        sanitize_error = f'分子校验失败: {str(e)}'
        logger.warning(f'SanitizeMol error: {e}')
    
    return mol.GetMol(), sanitize_failed, sanitize_error

def validate_atoms(atoms):
    if not isinstance(atoms, list):
        return False, 'atoms 必须是数组'
    for i, atom in enumerate(atoms):
        if not isinstance(atom, dict):
            return False, f'原子 #{i} 必须是对象'
        element = atom.get('element')
        if element not in VALID_ELEMENTS:
            return False, f'原子 #{i} 元素符号无效: {element}'
        for coord in ('x', 'y', 'z'):
            val = atom.get(coord)
            if val is None:
                return False, f'原子 #{i} 缺少坐标: {coord}'
            try:
                float(val)
            except (TypeError, ValueError):
                return False, f'原子 #{i} 坐标 {coord} 不是有效数值'
    return True, ''

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/calculate', methods=['POST'])
def calculate_properties():
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': '请求体为空'}), 400
        
        atoms = data.get('atoms', [])
        
        if not atoms:
            return jsonify({'success': False, 'error': '未提供原子数据'}), 400
        
        is_valid, validation_error = validate_atoms(atoms)
        if not is_valid:
            return jsonify({'success': False, 'error': validation_error}), 422
        
        bonds = calculate_bonds(atoms)
        mol, sanitize_failed, sanitize_error = build_molecule_from_atoms(atoms, bonds)
        
        if sanitize_failed:
            try:
                smiles = Chem.MolToSmiles(mol) if mol else 'N/A'
                formula = rdMolDescriptors.CalcMolFormula(mol) if mol else 'N/A'
                mol_weight = Descriptors.MolWt(mol) if mol else 0
                num_atoms = mol.GetNumAtoms() if mol else 0
                num_bonds = mol.GetNumBonds() if mol else 0
            except Exception:
                smiles = 'N/A'
                formula = 'N/A'
                mol_weight = 0
                num_atoms = len(atoms)
                num_bonds = len(bonds)
            
            return jsonify({
                'success': False,
                'error': sanitize_error,
                'partial': True,
                'smiles': smiles,
                'formula': formula,
                'molecular_weight': round(mol_weight, 3),
                'logp': 0,
                'num_atoms': num_atoms,
                'num_bonds': num_bonds,
                'tpsa': 0,
                'h_donors': 0,
                'h_acceptors': 0,
                'rotatable_bonds': 0,
                'bonds': bonds
            }), 422
        
        smiles = Chem.MolToSmiles(mol)
        formula = rdMolDescriptors.CalcMolFormula(mol)
        mol_weight = Descriptors.MolWt(mol)
        logp = Descriptors.MolLogP(mol)
        num_atoms = mol.GetNumAtoms()
        num_bonds = mol.GetNumBonds()
        tpsa = Descriptors.TPSA(mol)
        h_donors = Descriptors.NumHDonors(mol)
        h_acceptors = Descriptors.NumHAcceptors(mol)
        rotatable_bonds = Descriptors.NumRotatableBonds(mol)
        
        return jsonify({
            'success': True,
            'smiles': smiles,
            'formula': formula,
            'molecular_weight': round(mol_weight, 3),
            'logp': round(logp, 3),
            'num_atoms': num_atoms,
            'num_bonds': num_bonds,
            'tpsa': round(tpsa, 2),
            'h_donors': h_donors,
            'h_acceptors': h_acceptors,
            'rotatable_bonds': rotatable_bonds,
            'bonds': bonds
        })
        
    except Exception as e:
        logger.error(f'Unexpected error in calculate_properties: {e}', exc_info=True)
        return jsonify({
            'success': False,
            'error': f'服务器内部错误: {str(e)}'
        }), 500

def build_3d_molecule(atoms, bonds):
    mol = Chem.RWMol()
    atom_indices = []
    for atom in atoms:
        rdkit_atom = Chem.Atom(atom['element'])
        idx = mol.AddAtom(rdkit_atom)
        atom_indices.append(idx)
    for (i, j) in bonds:
        mol.AddBond(atom_indices[i], atom_indices[j], Chem.BondType.SINGLE)
    
    conf = Chem.Conformer(len(atoms))
    for i, atom in enumerate(atoms):
        conf.SetAtomPosition(i, (atom['x'], atom['y'], atom['z']))
    mol.AddConformer(conf)
    
    try:
        Chem.SanitizeMol(mol)
    except Exception as e:
        logger.warning(f'SanitizeMol warning during 3D build: {e}')
    
    return mol.GetMol()

def get_positions(mol):
    conf = mol.GetConformer()
    positions = []
    for i in range(mol.GetNumAtoms()):
        pos = conf.GetAtomPosition(i)
        positions.append([float(pos.x), float(pos.y), float(pos.z)])
    return positions

def calculate_energy(mol, force_field='mmff'):
    try:
        if force_field == 'mmff':
            props = AllChem.MMFFGetMoleculeProperties(mol)
            if props:
                ff = AllChem.MMFFGetMoleculeForceField(mol, props)
                return ff.CalcEnergy()
        props = AllChem.UFFGetMoleculeForceField(mol)
        if props:
            return props.CalcEnergy()
    except Exception as e:
        logger.warning(f'Energy calculation failed: {e}')
    return 0.0

@app.route('/api/optimize', methods=['POST'])
def optimize_structure():
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': '请求体为空'}), 400
        
        atoms = data.get('atoms', [])
        if not atoms:
            return jsonify({'success': False, 'error': '未提供原子数据'}), 400
        
        is_valid, validation_error = validate_atoms(atoms)
        if not is_valid:
            return jsonify({'success': False, 'error': validation_error}), 422
        
        bonds = calculate_bonds(atoms)
        mol = build_3d_molecule(atoms, bonds)
        
        if mol.GetNumAtoms() == 0:
            return jsonify({'success': False, 'error': '分子构建失败'}), 422
        
        force_field = 'mmff'
        ff = None
        try:
            props = AllChem.MMFFGetMoleculeProperties(mol)
            if props:
                ff = AllChem.MMFFGetMoleculeForceField(mol, props)
            else:
                force_field = 'uff'
        except Exception:
            force_field = 'uff'
        
        if ff is None:
            try:
                ff = AllChem.UFFGetMoleculeForceField(mol)
                force_field = 'uff'
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': f'力场初始化失败: {str(e)}'
                }), 422
        
        max_steps = 500
        step_interval = 10
        
        def generate():
            try:
                current_energy = calculate_energy(mol, force_field)
                initial_positions = get_positions(mol)
                
                yield f"data: {json.dumps({'type': 'progress', 'step': 0, 'total_steps': max_steps, 'energy': current_energy, 'positions': initial_positions})}\n\n"
                
                frame_count = 0
                for step in range(1, max_steps + 1):
                    try:
                        converged = ff.Minimize(maxIts=1)
                        current_energy = calculate_energy(mol, force_field)
                        
                        if step % step_interval == 0 or step == max_steps or converged:
                            positions = get_positions(mol)
                            frame_data = {
                                'type': 'progress',
                                'step': step,
                                'total_steps': max_steps,
                                'energy': current_energy,
                                'positions': positions
                            }
                            yield f"data: {json.dumps(frame_data)}\n\n"
                            frame_count += 1
                        
                        if converged:
                            final_positions = get_positions(mol)
                            final_data = {
                                'type': 'complete',
                                'step': step,
                                'total_steps': max_steps,
                                'energy': current_energy,
                                'positions': final_positions,
                                'converged': True
                            }
                            yield f"data: {json.dumps(final_data)}\n\n"
                            break
                    
                    except Exception as e:
                        logger.warning(f'Optimization step {step} error: {e}')
                        continue
                
                final_positions = get_positions(mol)
                final_energy = calculate_energy(mol, force_field)
                
                final_data = {
                    'type': 'complete',
                    'step': max_steps,
                    'total_steps': max_steps,
                    'energy': final_energy,
                    'positions': final_positions,
                    'converged': False
                }
                yield f"data: {json.dumps(final_data)}\n\n"
                yield "data: [DONE]\n\n"
                
            except GeneratorExit:
                logger.info('Optimization stream closed by client')
            except Exception as e:
                logger.error(f'Optimization error: {e}', exc_info=True)
                yield f"data: {json.dumps({'error': f'优化失败: {str(e)}'})}\n\n"
                yield "data: [DONE]\n\n"
        
        return Response(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
                'Connection': 'keep-alive'
            }
        )
        
    except Exception as e:
        logger.error(f'Unexpected error in optimize_structure: {e}', exc_info=True)
        return jsonify({
            'success': False,
            'error': f'服务器内部错误: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
