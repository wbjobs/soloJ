<script>
    import { onMount, onDestroy } from 'svelte';
    import * as THREE from 'three';
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
    import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
    import { structuralParams, fillingFraction } from '../../lib/stores/params.js';

    let canvas;
    let renderer, scene, camera, controls;
    let latticeGroup;
    let animationFrameId;
    let exportButton;

    function createMatrixGeometry(a, h) {
        const geom = new THREE.BoxGeometry(a, a, h);
        return geom;
    }

    function createCylinderGeometry(r, h, segments = 64) {
        const geom = new THREE.CylinderGeometry(r, r, h, segments, 1, false);
        geom.rotateX(Math.PI / 2);
        return geom;
    }

    function createUnitCell(params) {
        const group = new THREE.Group();

        const a = params.lattice_constant;
        const r = params.cylinder_radius;
        const h = params.cylinder_height;

        const matrixGeom = createMatrixGeometry(a, h);
        const matrixMat = new THREE.MeshPhysicalMaterial({
            color: 0x1a365d,
            transparent: true,
            opacity: 0.25,
            roughness: 0.3,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        const matrixMesh = new THREE.Mesh(matrixGeom, matrixMat);
        matrixMesh.position.set(0, 0, 0);
        matrixMesh.name = 'matrix';
        group.add(matrixMesh);

        const edgesGeom = new THREE.EdgesGeometry(matrixGeom);
        const edgesMat = new THREE.LineBasicMaterial({
            color: 0x3b82f6,
            opacity: 0.6,
            transparent: true
        });
        const edgesLine = new THREE.LineSegments(edgesGeom, edgesMat);
        edgesLine.position.copy(matrixMesh.position);
        group.add(edgesLine);

        const cylGeom = createCylinderGeometry(r, h);
        const cylMat = new THREE.MeshPhysicalMaterial({
            color: 0x06b6d4,
            transparent: true,
            opacity: 0.7,
            roughness: 0.2,
            metalness: 0.6,
            clearcoat: 0.3
        });
        const cylinder = new THREE.Mesh(cylGeom, cylMat);
        cylinder.name = 'cylinder';
        group.add(cylinder);

        const cylEdgesGeom = new THREE.EdgesGeometry(cylGeom);
        const cylEdgesMat = new THREE.LineBasicMaterial({
            color: 0x22d3ee,
            opacity: 0.4,
            transparent: true
        });
        const cylEdgesLine = new THREE.LineSegments(cylEdgesGeom, cylEdgesMat);
        cylEdgesLine.position.copy(cylinder.position);
        group.add(cylEdgesLine);

        return group;
    }

    function createExportableUnitCell(params) {
        const group = new THREE.Group();

        const a = params.lattice_constant;
        const r = params.cylinder_radius;
        const h = params.cylinder_height;

        const matrixGeom = new THREE.BoxGeometry(a, h, a);
        matrixGeom.translate(0, h / 2, 0);
        const matrixMat = new THREE.MeshStandardMaterial({
            color: 0x1a365d,
            roughness: 0.5
        });
        const matrixMesh = new THREE.Mesh(matrixGeom, matrixMat);
        matrixMesh.name = 'matrix';
        group.add(matrixMesh);

        const cylGeom = new THREE.CylinderGeometry(r, r, h, 64, 1, false);
        cylGeom.translate(0, h / 2, 0);
        const cylMat = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            roughness: 0.3,
            metalness: 0.5
        });
        const cylinder = new THREE.Mesh(cylGeom, cylMat);
        cylinder.name = 'cylinder';
        group.add(cylinder);

        return group;
    }

    function createLattice(params) {
        const group = new THREE.Group();
        const a = params.lattice_constant;
        const gridSize = 3;

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const cell = createUnitCell(params);
                cell.position.set(
                    (i - (gridSize - 1) / 2) * a,
                    (j - (gridSize - 1) / 2) * a,
                    params.cylinder_height / 2
                );
                group.add(cell);
            }
        }

        return group;
    }

    function updateModel(params) {
        if (!scene) return;

        if (latticeGroup) {
            scene.remove(latticeGroup);
            latticeGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        latticeGroup = createLattice(params);
        scene.add(latticeGroup);
    }

    function exportSTL() {
        const params = {
            lattice_constant: $structuralParams.lattice_constant,
            cylinder_radius: $structuralParams.cylinder_radius,
            cylinder_height: $structuralParams.cylinder_height
        };

        const exportGroup = createExportableUnitCell(params);

        const exporter = new STLExporter();
        const stl = exporter.parse(exportGroup, { binary: true });

        const blob = new Blob([stl], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `unit_cell_a${(params.lattice_constant * 1000).toFixed(1)}_r${(params.cylinder_radius * 1000).toFixed(1)}_h${(params.cylinder_height * 1000).toFixed(1)}.stl`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        exportGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    onMount(() => {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e1a);

        camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
        camera.position.set(0.15, 0.15, 0.25);
        camera.lookAt(0, 0, 0.03);

        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        const ambientLight = new THREE.AmbientLight(0x4488ff, 0.5);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight1.position.set(5, 5, 10);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x06b6d4, 0.5);
        dirLight2.position.set(-5, -3, 5);
        scene.add(dirLight2);

        const pointLight = new THREE.PointLight(0x8b5cf6, 0.3, 10);
        pointLight.position.set(0, 0, 3);
        scene.add(pointLight);

        scene.add(new THREE.GridHelper(0.5, 20, 0x1e3a5f, 0x0f1d2e));

        controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 0.05;
        controls.maxDistance = 1;
        controls.target.set(0, 0, 0.03);

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                    renderer.setSize(width, height);
                }
            }
        });
        resizeObserver.observe(canvas.parentElement);

        const params = {
            lattice_constant: $structuralParams.lattice_constant,
            cylinder_radius: $structuralParams.cylinder_radius,
            cylinder_height: $structuralParams.cylinder_height,
            filling_fraction: $fillingFraction
        };
        updateModel(params);
        animate();
    });

    $: if (scene) {
        updateModel({
            lattice_constant: $structuralParams.lattice_constant,
            cylinder_radius: $structuralParams.cylinder_radius,
            cylinder_height: $structuralParams.cylinder_height,
            filling_fraction: $fillingFraction
        });
    }

    onDestroy(() => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (renderer) renderer.dispose();
    });
</script>

<div class="viewer-container">
    <canvas bind:this={canvas}></canvas>
    <div class="viewer-overlay">
        <span class="overlay-label">3D 晶格结构预览</span>
    </div>
    <div class="viewer-actions">
        <button class="btn btn-secondary btn-sm" on:click={exportSTL}>
            ⬇ 导出 STL
        </button>
    </div>
</div>

<style>
    .viewer-container {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 8px;
        overflow: hidden;
        background: #0a0e1a;
    }

    canvas {
        width: 100%;
        height: 100%;
        display: block;
    }

    .viewer-overlay {
        position: absolute;
        top: 12px;
        left: 12px;
        pointer-events: none;
    }

    .overlay-label {
        font-size: 12px;
        color: #94a3b8;
        background: rgba(10, 14, 26, 0.7);
        padding: 4px 10px;
        border-radius: 4px;
        backdrop-filter: blur(4px);
    }

    .viewer-actions {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 8px;
    }

    .btn-sm {
        padding: 6px 12px;
        font-size: 12px;
    }
</style>
