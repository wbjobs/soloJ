class ProteinViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.proteinGroup = null;
        this.currentData = null;
        this.currentMode = 'ballstick';
        this.atomScale = 1.0;
        this.bondRadius = 0.1;
        this.showAxes = true;
        this.axesHelper = null;
        this.sharedGeometries = {};
        this.performanceMode = false;
        this.temperature = 0;
        this.activeVibrationMaterials = [];
        this.clock = new THREE.Clock();
        
        this.elementColors = {
            'C': 0x909090,
            'H': 0xffffff,
            'O': 0xff0d0d,
            'N': 0x3050f8,
            'S': 0xffff30,
            'P': 0xff8000,
            'default': 0x00ff00
        };

        this.atomRadii = {
            'C': 0.7,
            'H': 0.3,
            'O': 0.66,
            'N': 0.65,
            'S': 1.0,
            'P': 1.0,
            'default': 0.5
        };

        this.elementMasses = {
            'H': 1.008,
            'C': 12.011,
            'N': 14.007,
            'O': 15.999,
            'S': 32.06,
            'P': 30.974,
            'default': 12.0
        };

        this.init();
        this.setupEventListeners();
        this.loadSamples();
    }

    init() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a);

        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(30, 30, 30);

        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = false;
        container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 200;

        this.setupLighting();

        this.axesHelper = new THREE.AxesHelper(10);
        this.scene.add(this.axesHelper);

        this.proteinGroup = new THREE.Group();
        this.scene.add(this.proteinGroup);

        window.addEventListener('resize', () => this.onWindowResize());

        this.animate();
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x505050, 0.7);
        this.scene.add(ambientLight);

        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight1.position.set(50, 50, 50);
        this.scene.add(directionalLight1);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight2.position.set(-50, -30, -50);
        this.scene.add(directionalLight2);
    }

    getSharedSphereGeometry(quality = 'medium') {
        const key = `sphere_${quality}`;
        if (!this.sharedGeometries[key]) {
            let segments = 16;
            if (quality === 'low') segments = 8;
            if (quality === 'high') segments = 32;
            this.sharedGeometries[key] = new THREE.SphereGeometry(1, segments, segments);
        }
        return this.sharedGeometries[key];
    }

    getSharedCylinderGeometry(quality = 'medium') {
        const key = `cylinder_${quality}`;
        if (!this.sharedGeometries[key]) {
            let segments = 8;
            if (quality === 'low') segments = 6;
            if (quality === 'high') segments = 16;
            this.sharedGeometries[key] = new THREE.CylinderGeometry(1, 1, 1, segments);
        }
        return this.sharedGeometries[key];
    }

    createVibrationMaterial(color, type = 'phong') {
        const baseMaterial = type === 'phong' 
            ? new THREE.MeshPhongMaterial({ color, shininess: 100, specular: 0x333333 })
            : new THREE.MeshLambertMaterial({ color });
        
        const self = this;
        
        baseMaterial._vibrationUniforms = {
            uTime: { value: 0 },
            uTemperature: { value: this.temperature },
            uVibAmplitude: { value: 0.08 }
        };
        
        baseMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = baseMaterial._vibrationUniforms.uTime;
            shader.uniforms.uTemperature = baseMaterial._vibrationUniforms.uTemperature;
            shader.uniforms.uVibAmplitude = baseMaterial._vibrationUniforms.uVibAmplitude;
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                uniform float uTime;
                uniform float uTemperature;
                uniform float uVibAmplitude;
                float vibHash(float n) { return fract(sin(n) * 43758.5453123); }`
            );
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                #ifdef USE_INSTANCING
                    vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
                    float vs1 = vibHash(dot(iPos, vec3(1.0, 57.0, 113.0)));
                    float vs2 = vibHash(dot(iPos, vec3(157.0, 1.0, 61.0)));
                    float vs3 = vibHash(dot(iPos, vec3(31.0, 71.0, 1.0)));
                    float vFreq1 = 2.0 + vs1 * 4.0;
                    float vFreq2 = 2.0 + vs2 * 4.0;
                    float vFreq3 = 2.0 + vs3 * 4.0;
                    float vPhase1 = vs1 * 6.2831853;
                    float vPhase2 = vs2 * 6.2831853;
                    float vPhase3 = vs3 * 6.2831853;
                    float vAmp = uTemperature * uVibAmplitude;
                    transformed += vec3(
                        sin(uTime * vFreq1 + vPhase1) * vAmp,
                        cos(uTime * vFreq2 + vPhase2) * vAmp,
                        sin(uTime * vFreq3 + vPhase3) * vAmp
                    );
                #endif`
            );
        };
        
        this.activeVibrationMaterials.push(baseMaterial);
        return baseMaterial;
    }

    onWindowResize() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const elapsed = this.clock.getElapsedTime();
        
        for (const mat of this.activeVibrationMaterials) {
            if (mat._vibrationUniforms) {
                mat._vibrationUniforms.uTime.value = elapsed;
            }
        }
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    clearProtein() {
        this.activeVibrationMaterials = [];
        while (this.proteinGroup.children.length > 0) {
            const child = this.proteinGroup.children[0];
            if (child.geometry) {
                if (child.isInstancedMesh) {
                    child.instanceMatrix.dispose();
                }
                child.geometry.dispose();
            }
            this.proteinGroup.remove(child);
        }
    }

    getElementColor(element) {
        return this.elementColors[element] || this.elementColors['default'];
    }

    getAtomRadius(element) {
        return (this.atomRadii[element] || this.atomRadii['default']) * this.atomScale;
    }

    createBallStick(data) {
        this.clearProtein();
        
        const atomCount = data.atoms.length;
        const bondCount = data.bonds.length;
        this.performanceMode = atomCount > 10000;
        
        const quality = this.performanceMode ? 'low' : 'medium';
        const materialType = this.performanceMode ? 'lambert' : 'phong';
        
        const atomsByElement = this.groupAtomsByElement(data.atoms);
        const sphereGeometry = this.getSharedSphereGeometry(quality);
        
        const dummy = new THREE.Object3D();
        
        for (const [element, atoms] of Object.entries(atomsByElement)) {
            if (atoms.length === 0) continue;
            
            const color = this.getElementColor(element);
            const material = this.createVibrationMaterial(color, materialType);
            const baseRadius = this.getAtomRadius(element);
            
            const instancedMesh = new THREE.InstancedMesh(
                sphereGeometry,
                material,
                atoms.length
            );
            
            instancedMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
            
            for (let i = 0; i < atoms.length; i++) {
                const atom = atoms[i];
                dummy.position.set(atom.x, atom.y, atom.z);
                dummy.scale.set(baseRadius, baseRadius, baseRadius);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(i, dummy.matrix);
            }
            
            instancedMesh.instanceMatrix.needsUpdate = true;
            this.proteinGroup.add(instancedMesh);
        }
        
        if (bondCount > 0 && !this.performanceMode) {
            this.createBondsOptimized(data, quality, materialType);
        } else if (bondCount > 0 && this.performanceMode) {
            this.createBondsLines(data);
        }

        this.centerCamera();
    }

    groupAtomsByElement(atoms) {
        const groups = {};
        for (const atom of atoms) {
            const element = atom.element || 'default';
            if (!groups[element]) {
                groups[element] = [];
            }
            groups[element].push(atom);
        }
        return groups;
    }

    createBondsOptimized(data, quality, materialType) {
        const atomMap = new Map();
        data.atoms.forEach(atom => {
            atomMap.set(atom.serial, atom);
        });

        const cylinderGeometry = this.getSharedCylinderGeometry(quality);
        const bondMaterial = this.createVibrationMaterial(0x888888, materialType);
        bondMaterial._vibrationUniforms.uVibAmplitude.value = 0.05;
        
        const bonds = [];

        for (const bond of data.bonds) {
            const atom1 = atomMap.get(bond.from);
            const atom2 = atomMap.get(bond.to);
            
            if (atom1 && atom2) {
                bonds.push({ atom1, atom2 });
            }
        }

        if (bonds.length === 0) return;

        const instancedMesh = new THREE.InstancedMesh(
            cylinderGeometry,
            bondMaterial,
            bonds.length
        );
        
        instancedMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

        const dummy = new THREE.Object3D();
        const upVector = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i < bonds.length; i++) {
            const { atom1, atom2 } = bonds[i];
            const start = new THREE.Vector3(atom1.x, atom1.y, atom1.z);
            const end = new THREE.Vector3(atom2.x, atom2.y, atom2.z);
            const direction = end.clone().sub(start);
            const length = direction.length();
            
            dummy.position.copy(start.clone().add(end).multiplyScalar(0.5));
            dummy.quaternion.setFromUnitVectors(upVector, direction.normalize());
            dummy.scale.set(this.bondRadius, length, this.bondRadius);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        this.proteinGroup.add(instancedMesh);
    }

    createBondsLines(data) {
        const atomMap = new Map();
        data.atoms.forEach(atom => {
            atomMap.set(atom.serial, atom);
        });

        const points = [];
        
        for (const bond of data.bonds) {
            const atom1 = atomMap.get(bond.from);
            const atom2 = atomMap.get(bond.to);
            
            if (atom1 && atom2) {
                points.push(
                    new THREE.Vector3(atom1.x, atom1.y, atom1.z),
                    new THREE.Vector3(atom2.x, atom2.y, atom2.z)
                );
            }
        }

        if (points.length === 0) return;

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x666666,
            linewidth: 1
        });
        
        const lines = new THREE.LineSegments(geometry, material);
        this.proteinGroup.add(lines);
    }

    createSpaceFill(data) {
        this.clearProtein();
        
        const atomCount = data.atoms.length;
        this.performanceMode = atomCount > 10000;
        
        const quality = this.performanceMode ? 'low' : 'medium';
        const materialType = this.performanceMode ? 'lambert' : 'phong';
        
        const atomsByElement = this.groupAtomsByElement(data.atoms);
        const sphereGeometry = this.getSharedSphereGeometry(quality);
        
        const dummy = new THREE.Object3D();
        
        for (const [element, atoms] of Object.entries(atomsByElement)) {
            if (atoms.length === 0) continue;
            
            const color = this.getElementColor(element);
            const material = this.createVibrationMaterial(color, materialType);
            const baseRadius = this.getAtomRadius(element) * 1.5;
            
            const instancedMesh = new THREE.InstancedMesh(
                sphereGeometry,
                material,
                atoms.length
            );
            
            instancedMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
            
            for (let i = 0; i < atoms.length; i++) {
                const atom = atoms[i];
                dummy.position.set(atom.x, atom.y, atom.z);
                dummy.scale.set(baseRadius, baseRadius, baseRadius);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(i, dummy.matrix);
            }
            
            instancedMesh.instanceMatrix.needsUpdate = true;
            this.proteinGroup.add(instancedMesh);
        }

        this.centerCamera();
    }

    createRibbon(data) {
        this.clearProtein();
        
        const residues = data.residues.filter(r => r.ca);
        
        if (residues.length < 2) {
            this.createBallStick(data);
            return;
        }

        const helixColor = 0xff6b6b;
        const sheetColor = 0x4ecdc4;
        const coilColor = 0x95e1d3;

        const getResidueStructure = (residue) => {
            for (const ss of data.secondaryStructures) {
                if (ss.type === 'helix' || ss.type === 'sheet') {
                    if (residue.chainId === ss.startResidue.chainId &&
                        residue.seq >= ss.startResidue.seq &&
                        residue.seq <= ss.endResidue.seq) {
                        return ss.type;
                    }
                }
            }
            return 'coil';
        };

        const chains = {};
        residues.forEach(r => {
            if (!chains[r.chainId]) chains[r.chainId] = [];
            chains[r.chainId].push(r);
        });

        const cylinderGeometry = this.getSharedCylinderGeometry('medium');
        
        Object.values(chains).forEach(chainResidues => {
            chainResidues.sort((a, b) => a.seq - b.seq);
            
            const helixMeshes = [];
            const sheetMeshes = [];
            const coilMeshes = [];
            
            for (let i = 0; i < chainResidues.length - 1; i++) {
                const r1 = chainResidues[i];
                const r2 = chainResidues[i + 1];
                
                const structure = getResidueStructure(r1);
                let color = coilColor;
                let thickness = 0.3;
                let targetArray = coilMeshes;
                
                if (structure === 'helix') {
                    color = helixColor;
                    thickness = 0.5;
                    targetArray = helixMeshes;
                } else if (structure === 'sheet') {
                    color = sheetColor;
                    thickness = 0.4;
                    targetArray = sheetMeshes;
                }

                const start = new THREE.Vector3(r1.ca.x, r1.ca.y, r1.ca.z);
                const end = new THREE.Vector3(r2.ca.x, r2.ca.y, r2.ca.z);
                
                targetArray.push({ start, end, thickness, color });
            }

            const createInstancedCylinders = (segments) => {
                if (segments.length === 0) return;
                
                const material = this.createVibrationMaterial(segments[0].color, 'phong');
                material._vibrationUniforms.uVibAmplitude.value = 0.05;
                const instancedMesh = new THREE.InstancedMesh(
                    cylinderGeometry,
                    material,
                    segments.length
                );
                
                instancedMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
                
                const dummy = new THREE.Object3D();
                const upVector = new THREE.Vector3(0, 1, 0);
                
                for (let i = 0; i < segments.length; i++) {
                    const seg = segments[i];
                    const direction = seg.end.clone().sub(seg.start);
                    const length = direction.length();
                    
                    dummy.position.copy(seg.start.clone().add(seg.end).multiplyScalar(0.5));
                    dummy.quaternion.setFromUnitVectors(upVector, direction.normalize());
                    dummy.scale.set(seg.thickness, length, seg.thickness);
                    dummy.updateMatrix();
                    instancedMesh.setMatrixAt(i, dummy.matrix);
                }
                
                instancedMesh.instanceMatrix.needsUpdate = true;
                this.proteinGroup.add(instancedMesh);
            };

            createInstancedCylinders(helixMeshes);
            createInstancedCylinders(sheetMeshes);
            createInstancedCylinders(coilMeshes);

            if (chainResidues.length > 0) {
                const sphereGeometry = this.getSharedSphereGeometry('medium');
                const spheres = [];
                
                for (let i = 0; i < chainResidues.length; i++) {
                    const r = chainResidues[i];
                    const structure = getResidueStructure(r);
                    let thickness = 0.3;
                    let color = coilColor;
                    
                    if (structure === 'helix') {
                        thickness = 0.5;
                        color = helixColor;
                    } else if (structure === 'sheet') {
                        thickness = 0.4;
                        color = sheetColor;
                    }
                    
                    spheres.push({
                        position: new THREE.Vector3(r.ca.x, r.ca.y, r.ca.z),
                        thickness,
                        color
                    });
                }

                const spheresByColor = {};
                spheres.forEach(s => {
                    if (!spheresByColor[s.color]) spheresByColor[s.color] = [];
                    spheresByColor[s.color].push(s);
                });

                const dummy = new THREE.Object3D();
                for (const [color, sphereList] of Object.entries(spheresByColor)) {
                    const material = this.createVibrationMaterial(parseInt(color), 'phong');
                    material._vibrationUniforms.uVibAmplitude.value = 0.05;
                    const instancedMesh = new THREE.InstancedMesh(
                        sphereGeometry,
                        material,
                        sphereList.length
                    );
                    
                    for (let i = 0; i < sphereList.length; i++) {
                        const s = sphereList[i];
                        dummy.position.copy(s.position);
                        dummy.scale.set(s.thickness, s.thickness, s.thickness);
                        dummy.updateMatrix();
                        instancedMesh.setMatrixAt(i, dummy.matrix);
                    }
                    
                    instancedMesh.instanceMatrix.needsUpdate = true;
                    this.proteinGroup.add(instancedMesh);
                }
            }
        });

        this.centerCamera();
    }

    centerCamera() {
        const box = new THREE.Box3().setFromObject(this.proteinGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        
        this.camera.position.set(
            center.x + cameraZ,
            center.y + cameraZ,
            center.z + cameraZ
        );
        
        this.controls.target.copy(center);
        this.controls.update();
    }

    setDisplayMode(mode) {
        this.currentMode = mode;
        if (this.currentData) {
            this.showLoading();
            setTimeout(() => {
                switch (mode) {
                    case 'ballstick':
                        this.createBallStick(this.currentData);
                        break;
                    case 'spacefill':
                        this.createSpaceFill(this.currentData);
                        break;
                    case 'ribbon':
                        this.createRibbon(this.currentData);
                        break;
                }
                this.hideLoading();
            }, 50);
        }
    }

    updateAtomScale(value) {
        this.atomScale = value;
        if (this.currentData) {
            this.setDisplayMode(this.currentMode);
        }
    }

    updateBondRadius(value) {
        this.bondRadius = value;
        if (this.currentData && this.currentMode === 'ballstick') {
            this.createBallStick(this.currentData);
        }
    }

    toggleAxes(show) {
        this.showAxes = show;
        this.axesHelper.visible = show;
    }

    updateTemperature(value) {
        this.temperature = value;
        
        const tempValueEl = document.getElementById('temperatureValue');
        tempValueEl.textContent = value;
        tempValueEl.style.color = this.getTemperatureColor(value);
        
        for (const mat of this.activeVibrationMaterials) {
            if (mat._vibrationUniforms) {
                mat._vibrationUniforms.uTemperature.value = value;
            }
        }
        
        this.updateKineticEnergy();
    }

    getTemperatureColor(temp) {
        if (temp <= 0) return '#3050f8';
        if (temp <= 77) {
            const t = temp / 77;
            return this.lerpColor('#3050f8', '#00d9ff', t);
        }
        if (temp <= 298) {
            const t = (temp - 77) / (298 - 77);
            return this.lerpColor('#00d9ff', '#ffff30', t);
        }
        if (temp <= 1000) {
            const t = (temp - 298) / (1000 - 298);
            return this.lerpColor('#ffff30', '#ff8800', t);
        }
        const t = Math.min((temp - 1000) / 2000, 1);
        return this.lerpColor('#ff8800', '#ff0d0d', t);
    }

    lerpColor(a, b, t) {
        const ar = parseInt(a.slice(1, 3), 16);
        const ag = parseInt(a.slice(3, 5), 16);
        const ab = parseInt(a.slice(5, 7), 16);
        const br = parseInt(b.slice(1, 3), 16);
        const bg = parseInt(b.slice(3, 5), 16);
        const bb = parseInt(b.slice(5, 7), 16);
        const r = Math.round(ar + (br - ar) * t);
        const g = Math.round(ag + (bg - ag) * t);
        const bl = Math.round(ab + (bb - ab) * t);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
    }

    updateKineticEnergy() {
        const T = this.temperature;
        const N = this.currentData ? this.currentData.stats.atomCount : 0;
        
        const kB = 1.380649e-23;
        const eV = 1.602176634e-19;
        const R = 8.314462618;
        
        const ekPerAtom = 1.5 * kB * T;
        const ekPerAtomEV = ekPerAtom / eV;
        const ekTotal = ekPerAtom * N;
        const ekPerMol = 1.5 * R * T / 1000;
        
        document.getElementById('ekAtom').textContent = ekPerAtomEV.toFixed(4) + ' eV';
        document.getElementById('ekMol').textContent = ekPerMol.toFixed(2) + ' kJ/mol';
        document.getElementById('ekTotal').textContent = this.formatEnergy(ekTotal);
    }

    formatEnergy(joules) {
        if (joules === 0) return '0 J';
        const abs = Math.abs(joules);
        if (abs >= 1e-3) return (joules * 1e3).toFixed(2) + ' mJ';
        if (abs >= 1e-6) return (joules * 1e6).toFixed(2) + ' μJ';
        if (abs >= 1e-9) return (joules * 1e9).toFixed(2) + ' nJ';
        if (abs >= 1e-12) return (joules * 1e12).toFixed(2) + ' pJ';
        if (abs >= 1e-15) return (joules * 1e15).toFixed(2) + ' fJ';
        return joules.toExponential(2) + ' J';
    }

    async loadPDBFile(file) {
        this.showLoading();
        
        const formData = new FormData();
        formData.append('pdbFile', file);
        
        try {
            const response = await fetch('/api/parse-pdb', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentData = result.data;
                this.updateStats(result.data);
                this.setDisplayMode(this.currentMode);
            } else {
                alert('解析 PDB 文件失败: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('加载文件失败');
        }
        
        this.hideLoading();
    }

    async loadSamplePDB(id) {
        if (!id) return;
        
        this.showLoading();
        
        try {
            const response = await fetch(`/api/sample-pdb/${id}`);
            const result = await response.json();
            
            if (result.success) {
                this.currentData = result.data;
                this.updateStats(result.data);
                this.setDisplayMode(this.currentMode);
            } else {
                alert('加载示例失败: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('加载示例失败');
        }
        
        this.hideLoading();
    }

    async loadSamples() {
        try {
            const response = await fetch('/api/samples');
            const result = await response.json();
            
            if (result.success && result.samples.length > 0) {
                const select = document.getElementById('sampleSelect');
                result.samples.forEach(sample => {
                    const option = document.createElement('option');
                    option.value = sample;
                    option.textContent = sample;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading samples:', error);
        }
    }

    updateStats(data) {
        const statsDiv = document.getElementById('stats');
        const perfHint = data.stats.atomCount > 10000 ? 
            '<div class="stat-item"><span>性能模式</span><span class="stat-value">已启用</span></div>' : '';
        
        statsDiv.innerHTML = `
            <div class="stat-item">
                <span>原子数量</span>
                <span class="stat-value">${data.stats.atomCount}</span>
            </div>
            <div class="stat-item">
                <span>化学键数量</span>
                <span class="stat-value">${data.stats.bondCount}</span>
            </div>
            <div class="stat-item">
                <span>残基数量</span>
                <span class="stat-value">${data.stats.residueCount}</span>
            </div>
            <div class="stat-item">
                <span>链数量</span>
                <span class="stat-value">${data.stats.chainCount}</span>
            </div>
            <div class="stat-item">
                <span>二级结构</span>
                <span class="stat-value">${data.secondaryStructures.length}</span>
            </div>
            ${perfHint}
        `;
        
        this.updateKineticEnergy();
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    setupEventListeners() {
        document.getElementById('pdbFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadPDBFile(file);
            }
        });

        document.getElementById('loadSample').addEventListener('click', () => {
            const id = document.getElementById('sampleSelect').value;
            this.loadSamplePDB(id);
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.setDisplayMode(e.target.dataset.mode);
            });
        });

        document.getElementById('atomScale').addEventListener('input', (e) => {
            document.getElementById('atomScaleValue').textContent = e.target.value;
            this.updateAtomScale(parseFloat(e.target.value));
        });

        document.getElementById('bondRadius').addEventListener('input', (e) => {
            document.getElementById('bondRadiusValue').textContent = e.target.value;
            this.updateBondRadius(parseFloat(e.target.value));
        });

        document.getElementById('showAxes').addEventListener('change', (e) => {
            this.toggleAxes(e.target.checked);
        });

        document.getElementById('temperature').addEventListener('input', (e) => {
            this.updateTemperature(parseInt(e.target.value));
        });

        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const temp = parseInt(e.target.dataset.temp);
                document.getElementById('temperature').value = temp;
                this.updateTemperature(temp);
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.viewer = new ProteinViewer();
});
