import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import PointCloudRenderer from './renderer/PointCloudRenderer.js';
import MeasurementTool from './tools/MeasurementTool.js';
import api from './api/api.js';
import ClassificationAPI from './api/classification.js';

class App {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.pointCloudRenderer = null;
    this.measurementTool = null;
    this.classificationAPI = null;
    this.controls = null;
    this.animationId = null;
    this.fpsFrames = 0;
    this.fpsLastTime = performance.now();
    this.currentFPS = 60;

    this.selectMode = false;
    this.selectionStart = null;
    this.selectionEnd = null;
    this.selectedPoints = [];

    this.visibleCategories = [0, 1, 2, 3, 4, 5, 6];
    this.annotations = [];

    this._initScene();
    this._initUI();
    this._loadDatasets();
    this._startAnimation();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000000
    );
    this.camera.position.set(100, 100, 100);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    this.pointCloudRenderer = new PointCloudRenderer(this.scene);

    this.measurementTool = new MeasurementTool(
      this.scene,
      this.camera,
      this.renderer
    );

    this.classificationAPI = new ClassificationAPI(api);

    this._setupMeasurementEvents();
    this._setupSelectionEvents();

    window.addEventListener('resize', () => this._onResize());
  }

  _initUI() {
    this.$datasetSelect = document.getElementById('dataset-select');
    this.$uploadBtn = document.getElementById('upload-btn');
    this.$coloringMode = document.getElementById('coloring-mode');
    this.$pointSize = document.getElementById('point-size');
    this.$pointSizeValue = document.getElementById('point-size-value');
    this.$lodLevel = document.getElementById('lod-level');
    this.$lodLevelValue = document.getElementById('lod-level-value');
    this.$measureBtn = document.getElementById('measure-btn');
    this.$selectBtn = document.getElementById('select-btn');
    this.$clearMeasureBtn = document.getElementById('clear-measure-btn');
    this.$resetViewBtn = document.getElementById('reset-view-btn');
    this.$measurementPanel = document.getElementById('measurement-panel');
    this.$measurementPoints = document.getElementById('measurement-points');
    this.$measurementResult = document.getElementById('measurement-result');
    this.$distanceValue = document.getElementById('distance-value');
    this.$pointsCount = document.getElementById('points-count');
    this.$chunksCount = document.getElementById('chunks-count');
    this.$lodLevelDisplay = document.getElementById('lod-level-display');
    this.$fps = document.getElementById('fps');
    this.$loadingOverlay = document.getElementById('loading-overlay');
    this.$loadingText = document.getElementById('loading-text');
    this.$loadingProgress = document.getElementById('loading-progress');
    this.$uploadModal = document.getElementById('upload-modal');
    this.$dropZone = document.getElementById('drop-zone');
    this.$fileInput = document.getElementById('file-input');
    this.$cancelUploadBtn = document.getElementById('cancel-upload-btn');
    this.$uploadProgressContainer = document.getElementById('upload-progress-container');
    this.$uploadStatus = document.getElementById('upload-status');
    this.$uploadProgress = document.getElementById('upload-progress');

    this.$categoryCheckboxes = document.querySelectorAll('[id^="cat-"]');
    this.$showAllBtn = document.getElementById('show-all-btn');
    this.$hideAllBtn = document.getElementById('hide-all-btn');

    this.$annotationPanel = document.getElementById('annotation-panel');
    this.$annotationList = document.getElementById('annotation-list');
    this.$annotationForm = document.getElementById('annotation-form');
    this.$annotationName = document.getElementById('annotation-name');
    this.$annotationCategory = document.getElementById('annotation-category');
    this.$saveAnnotationBtn = document.getElementById('save-annotation-btn');
    this.$cancelAnnotationBtn = document.getElementById('cancel-annotation-btn');

    this.$datasetSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        this._loadPointCloud(e.target.value);
      }
    });

    this.$uploadBtn.addEventListener('click', () => {
      this.$uploadModal.classList.add('active');
    });

    this.$cancelUploadBtn.addEventListener('click', () => {
      this.$uploadModal.classList.remove('active');
    });

    this.$dropZone.addEventListener('click', () => {
      this.$fileInput.click();
    });

    this.$fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this._uploadFile(e.target.files[0]);
      }
    });

    this.$dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.$dropZone.classList.add('dragover');
    });

    this.$dropZone.addEventListener('dragleave', () => {
      this.$dropZone.classList.remove('dragover');
    });

    this.$dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.$dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        this._uploadFile(e.dataTransfer.files[0]);
      }
    });

    this.$coloringMode.addEventListener('change', (e) => {
      this.pointCloudRenderer.setColoringMode(e.target.value);
    });

    this.$pointSize.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.$pointSizeValue.textContent = value;
      this.pointCloudRenderer.setPointSize(value);
    });

    this.$lodLevel.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.$lodLevelValue.textContent = value >= 10 ? 'Auto' : value;
      this.pointCloudRenderer.setMaxLOD(value >= 10 ? 10 : value);
    });

    this.$measureBtn.addEventListener('click', () => {
      this._toggleMeasurement();
    });

    this.$selectBtn.addEventListener('click', () => {
      this._toggleSelectionMode();
    });

    this.$clearMeasureBtn.addEventListener('click', () => {
      this.measurementTool.clear();
      this._updateMeasurementUI();
    });

    this.$resetViewBtn.addEventListener('click', () => {
      this._resetView();
    });

    this.renderer.domElement.addEventListener('click', (e) => {
      if (this.measurementTool.active && !this.selectMode) {
        const meshes = this.pointCloudRenderer.getLoadedMeshes();
        this.measurementTool.handleClick(e, this.renderer.domElement, meshes);
      }
    });

    this.$categoryCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this._updateCategoryFilter();
      });
    });

    this.$showAllBtn.addEventListener('click', () => {
      this.$categoryCheckboxes.forEach(cb => cb.checked = true);
      this._updateCategoryFilter();
    });

    this.$hideAllBtn.addEventListener('click', () => {
      this.$categoryCheckboxes.forEach(cb => cb.checked = false);
      this._updateCategoryFilter();
    });

    this.$saveAnnotationBtn.addEventListener('click', () => {
      this._saveAnnotation();
    });

    this.$cancelAnnotationBtn.addEventListener('click', () => {
      this._cancelAnnotation();
    });

    this.measurementTool.onPointAdded = () => this._updateMeasurementUI();
    this.measurementTool.onPointRemoved = () => this._updateMeasurementUI();
    this.measurementTool.onDistanceChanged = () => this._updateMeasurementUI();
  }

  _setupMeasurementEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.selectMode) {
          this._toggleSelectionMode();
        } else if (this.measurementTool.active) {
          this._toggleMeasurement();
        }
      }
      if (e.key === 'Backspace' && this.measurementTool.active && !this.selectMode) {
        this.measurementTool.removeLastPoint();
      }
    });
  }

  _setupSelectionEvents() {
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      if (this.selectMode && e.button === 0) {
        this.selectionStart = { x: e.clientX, y: e.clientY };
        this.selectionEnd = null;
        this._updateSelectionOverlay();
      }
    });

    this.renderer.domElement.addEventListener('mousemove', (e) => {
      if (this.selectMode && this.selectionStart) {
        this.selectionEnd = { x: e.clientX, y: e.clientY };
        this._updateSelectionOverlay();
      }
    });

    this.renderer.domElement.addEventListener('mouseup', (e) => {
      if (this.selectMode && this.selectionStart && e.button === 0) {
        this.selectionEnd = { x: e.clientX, y: e.clientY };
        this._performSelection();
      }
    });
  }

  _toggleMeasurement() {
    if (this.selectMode) {
      this._toggleSelectionMode();
    }

    if (this.measurementTool.active) {
      this.measurementTool.deactivate();
      this.$measureBtn.textContent = 'Measure Distance';
      this.$measureBtn.classList.remove('btn-primary');
      this.$measurementPanel.style.display = 'none';
      this.controls.enabled = true;
    } else {
      this.measurementTool.activate();
      this.$measureBtn.textContent = 'Cancel Measurement (Esc)';
      this.$measureBtn.classList.add('btn-primary');
      this.$measurementPanel.style.display = 'block';
      this.controls.enabled = false;
      this.$clearMeasureBtn.style.display = 'block';
    }
  }

  _toggleSelectionMode() {
    if (this.measurementTool.active) {
      this._toggleMeasurement();
    }

    this.selectMode = !this.selectMode;
    this.controls.enabled = !this.selectMode;

    if (this.selectMode) {
      this.$selectBtn.textContent = 'Cancel Selection (Esc)';
      this.$selectBtn.classList.add('btn-primary');
      this.$annotationPanel.style.display = 'block';
      this.selectionStart = null;
      this.selectionEnd = null;
      this._updateSelectionOverlay();
    } else {
      this.$selectBtn.textContent = 'Select & Annotate';
      this.$selectBtn.classList.remove('btn-primary');
      this.$annotationPanel.style.display = 'none';
      this.selectionStart = null;
      this.selectionEnd = null;
      this._updateSelectionOverlay();
      this.selectedPoints = [];
    }
  }

  _updateSelectionOverlay() {
    let overlay = document.getElementById('selection-overlay');

    if (!this.selectMode || !this.selectionStart) {
      if (overlay) overlay.remove();
      return;
    }

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'selection-overlay';
      overlay.className = 'selection-overlay';
      document.body.appendChild(overlay);
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const x1 = this.selectionStart.x - rect.left;
    const y1 = this.selectionStart.y - rect.top;
    const x2 = this.selectionEnd ? this.selectionEnd.x - rect.left : x1;
    const y2 = this.selectionEnd ? this.selectionEnd.y - rect.top : y1;

    overlay.style.left = `${Math.min(x1, x2)}px`;
    overlay.style.top = `${Math.min(y1, y2)}px`;
    overlay.style.width = `${Math.abs(x2 - x1)}px`;
    overlay.style.height = `${Math.abs(y2 - y1)}px`;
  }

  async _performSelection() {
    if (!this.selectionStart || !this.selectionEnd) {
      this.selectionStart = null;
      this.selectionEnd = null;
      this._updateSelectionOverlay();
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x) - rect.left;
    const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y) - rect.top;
    const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x) - rect.left;
    const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y) - rect.top;

    if (Math.abs(x2 - x1) < 5 || Math.abs(y2 - y1) < 5) {
      this.selectionStart = null;
      this.selectionEnd = null;
      this._updateSelectionOverlay();
      return;
    }

    this._showLoading('Selecting points...');

    try {
      const nx1 = (x1 / this.container.clientWidth) * 2 - 1;
      const ny1 = -(y1 / this.container.clientHeight) * 2 + 1;
      const nx2 = (x2 / this.container.clientWidth) * 2 - 1;
      const ny2 = -(y2 / this.container.clientHeight) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      const plane = new THREE.Plane();
      const normal = new THREE.Vector3(0, 0, 1);
      normal.applyQuaternion(this.camera.quaternion);
      plane.setFromNormalAndCoplanarPoint(normal, this.controls.target);

      const corners = [
        new THREE.Vector2(nx1, ny1),
        new THREE.Vector2(nx2, ny1),
        new THREE.Vector2(nx2, ny2),
        new THREE.Vector2(nx1, ny2),
      ];

      const worldCorners = corners.map(corner => {
        raycaster.setFromCamera(corner, this.camera);
        const point = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, point);
        return point;
      });

      const region = {
        minX: Math.min(...worldCorners.map(p => p.x)),
        maxX: Math.max(...worldCorners.map(p => p.x)),
        minY: Math.min(...worldCorners.map(p => p.y)),
        maxY: Math.max(...worldCorners.map(p => p.y)),
        minZ: Math.min(...worldCorners.map(p => p.z)),
        maxZ: Math.max(...worldCorners.map(p => p.z)),
      };

      this.selectedPoints = this.pointCloudRenderer.getPointsInRegion(region);

      if (this.selectedPoints.length > 0) {
        this.$annotationForm.style.display = 'block';
        this._updateAnnotationList();
      }

    } catch (error) {
      console.error('Selection error:', error);
      alert('Selection failed: ' + error.message);
    } finally {
      this._hideLoading();
      this.selectionStart = null;
      this.selectionEnd = null;
      this._updateSelectionOverlay();
    }
  }

  _updateCategoryFilter() {
    this.visibleCategories = [];
    this.$categoryCheckboxes.forEach(cb => {
      if (cb.checked) {
        this.visibleCategories.push(parseInt(cb.dataset.category));
      }
    });

    if (this.visibleCategories.length === 7) {
      this.pointCloudRenderer.clearCategoryFilter();
    } else {
      this.pointCloudRenderer.setCategoryFilter(this.visibleCategories);
    }
  }

  _updateMeasurementUI() {
    const points = this.measurementTool.points;
    this.$measurementPoints.innerHTML = '';

    points.forEach((point, index) => {
      const div = document.createElement('div');
      div.className = 'point-item';
      div.innerHTML = `
        <span>P${index + 1}</span>
        <span>(${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)})</span>
      `;
      this.$measurementPoints.appendChild(div);
    });

    if (points.length >= 2) {
      const distance = this.measurementTool.getTotalDistance();
      this.$measurementResult.style.display = 'block';
      this.$distanceValue.textContent = `${distance.toFixed(2)} m`;
    } else {
      this.$measurementResult.style.display = 'none';
    }
  }

  _updateAnnotationList() {
    this.$annotationList.innerHTML = '';

    this.annotations.forEach((annotation, index) => {
      const div = document.createElement('div');
      div.className = 'annotation-item';
      div.innerHTML = `
        <div class="annotation-info">
          <div class="annotation-name">${annotation.name}</div>
          <div class="annotation-category">${annotation.category} - ${annotation.pointCount} points</div>
        </div>
        <div class="annotation-actions">
          <button data-index="${index}">Delete</button>
        </div>
      `;
      this.$annotationList.appendChild(div);

      div.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        this.annotations.splice(index, 1);
        this._updateAnnotationList();
      });
    });

    if (this.selectedPoints.length > 0 && this.$annotationForm.style.display === 'none') {
      const infoDiv = document.createElement('div');
      infoDiv.style.cssText = 'padding: 8px; background: rgba(255, 152, 0, 0.1); border-radius: 4px; margin-bottom: 8px; font-size: 12px;';
      infoDiv.innerHTML = `${this.selectedPoints.length} points selected`;
      this.$annotationList.appendChild(infoDiv);
    }
  }

  async _saveAnnotation() {
    const name = this.$annotationName.value.trim();
    const category = this.$annotationCategory.value;

    if (!name || this.selectedPoints.length === 0) {
      alert('Please enter a name and select points');
      return;
    }

    const annotation = {
      name,
      description: '',
      category,
      points: this.selectedPoints.slice(0, 1000),
      color: '#ff9800',
    };

    try {
      if (this.pointCloudRenderer.pointCloudId) {
        await this.classificationAPI.createAnnotation(
          this.pointCloudRenderer.pointCloudId,
          annotation
        );
      }

      this.annotations.push({
        ...annotation,
        pointCount: this.selectedPoints.length,
      });

      this.$annotationName.value = '';
      this.$annotationForm.style.display = 'none';
      this.selectedPoints = [];
      this._updateAnnotationList();

      alert('Annotation saved successfully!');
    } catch (error) {
      console.error('Save annotation error:', error);
      alert('Failed to save annotation: ' + error.message);
    }
  }

  _cancelAnnotation() {
    this.$annotationForm.style.display = 'none';
    this.$annotationName.value = '';
    this.selectedPoints = [];
    this._updateAnnotationList();
  }

  async _loadDatasets() {
    try {
      const datasets = await api.listPointClouds();
      this.$datasetSelect.innerHTML = '<option value="">Select a dataset...</option>';

      for (const dataset of datasets) {
        const option = document.createElement('option');
        option.value = dataset._id;
        option.textContent = `${dataset.name} (${dataset.totalPoints.toLocaleString()} points) - ${dataset.status}`;
        if (dataset.status !== 'ready') {
          option.disabled = true;
        }
        this.$datasetSelect.appendChild(option);
      }
    } catch (error) {
      console.error('Error loading datasets:', error);
    }
  }

  async _loadPointCloud(pointCloudId) {
    this._showLoading('Loading point cloud...');

    try {
      const info = await this.pointCloudRenderer.loadPointCloud(pointCloudId);

      const center = this.pointCloudRenderer.getCenter();
      const radius = this.pointCloudRenderer.getRadius();

      this.camera.position.set(
        center.x + radius * 1.5,
        center.y + radius * 1.5,
        center.z + radius * 0.5
      );
      this.controls.target.copy(center);
      this.controls.update();

      try {
        this.annotations = await this.classificationAPI.getAnnotations(pointCloudId);
        this._updateAnnotationList();
      } catch (e) {
        console.log('No annotations found');
      }

      this._hideLoading();
    } catch (error) {
      console.error('Error loading point cloud:', error);
      this._hideLoading();
      alert('Failed to load point cloud: ' + error.message);
    }
  }

  async _uploadFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'las' && ext !== 'laz') {
      alert('Please upload a LAS or LAZ file');
      return;
    }

    this.$uploadProgressContainer.style.display = 'block';
    this.$uploadStatus.textContent = 'Uploading...';
    this.$uploadProgress.style.width = '0%';

    try {
      const result = await api.uploadLAS(file, (progress) => {
        this.$uploadProgress.style.width = `${progress}%`;
      });

      this.$uploadStatus.textContent = 'Processing... This may take a few minutes.';
      this.$uploadProgress.style.width = '100%';

      setTimeout(() => {
        this.$uploadModal.classList.remove('active');
        this.$uploadProgressContainer.style.display = 'none';
        this._loadDatasets();
        alert('Upload complete! The dataset is being processed and will be available shortly.');
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
      this.$uploadProgressContainer.style.display = 'none';
    }
  }

  _resetView() {
    if (this.pointCloudRenderer.pointCloudInfo) {
      const center = this.pointCloudRenderer.getCenter();
      const radius = this.pointCloudRenderer.getRadius();

      this.camera.position.set(
        center.x + radius * 1.5,
        center.y + radius * 1.5,
        center.z + radius * 0.5
      );
      this.controls.target.copy(center);
      this.controls.update();
    }
  }

  _showLoading(text = 'Loading...') {
    this.$loadingText.textContent = text;
    this.$loadingOverlay.classList.add('active');
  }

  _hideLoading() {
    this.$loadingOverlay.classList.remove('active');
  }

  _onResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  _startAnimation() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      this.controls.update();

      if (this.pointCloudRenderer.pointCloudId) {
        this.pointCloudRenderer.update(this.camera, this.renderer);
      }

      this.renderer.render(this.scene, this.camera);
      this._updateStats();
    };

    animate();
  }

  _updateStats() {
    this.fpsFrames++;
    const now = performance.now();

    if (now - this.fpsLastTime >= 1000) {
      this.currentFPS = Math.round(this.fpsFrames * 1000 / (now - this.fpsLastTime));
      this.fpsFrames = 0;
      this.fpsLastTime = now;

      this.$fps.textContent = this.currentFPS;
      this.$pointsCount.textContent = this.pointCloudRenderer.stats.pointsRendered.toLocaleString();
      this.$chunksCount.textContent = this.pointCloudRenderer.stats.chunksLoaded;

      const lods = new Set();
      for (const chunk of this.pointCloudRenderer.chunks.values()) {
        lods.add(chunk.userData.lodLevel);
      }
      const lodStr = Array.from(lods).sort((a, b) => a - b).join(', ');
      this.$lodLevelDisplay.textContent = lodStr || '-';
    }
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.pointCloudRenderer.dispose();
    this.measurementTool.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
