import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AnnotationMarker } from './AnnotationMarker.js';

export class SceneManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.model = null;
    this.modelRoot = null;
    this.modelTransform = {
      scale: 1,
      centerOffset: { x: 0, y: 0, z: 0 },
      normalized: false
    };
    this.annotationMarkers = new Map();
    this.remoteCameras = new Map();
    this.placementPreview = null;
    this.eventListeners = {};
    this.animationId = null;
    this.clock = new THREE.Clock();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a12);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(5, 3, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 50;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 5, -5);
    this.scene.add(backLight);

    const gridHelper = new THREE.GridHelper(20, 20, 0x333333, 0x222222);
    this.scene.add(gridHelper);

    window.addEventListener('resize', () => this._onResize());
    this.renderer.domElement.addEventListener('click', (e) => this._onClick(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this._onMouseMove(e));

    this._animate();
  }

  async loadModel(url, expectedTransform = null) {
    const loader = new GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          if (this.modelRoot) {
            this.scene.remove(this.modelRoot);
          }

          this.modelRoot = new THREE.Group();
          this.model = gltf.scene;

          const box = new THREE.Box3().setFromObject(this.model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 3 / maxDim;

          if (expectedTransform) {
            this.modelTransform = { ...expectedTransform, normalized: true };
          } else {
            this.modelTransform = {
              scale: scale,
              centerOffset: {
                x: -center.x * scale,
                y: -center.y * scale,
                z: -center.z * scale
              },
              originalCenter: { x: center.x, y: center.y, z: center.z },
              originalMaxDim: maxDim,
              normalized: true
            };
          }

          this.model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.side = THREE.DoubleSide;
              }
            }
          });

          this.model.position.set(
            this.modelTransform.centerOffset.x,
            this.modelTransform.centerOffset.y,
            this.modelTransform.centerOffset.z
          );
          this.model.scale.setScalar(this.modelTransform.scale);

          this.modelRoot.add(this.model);
          this.scene.add(this.modelRoot);

          const newBox = new THREE.Box3().setFromObject(this.modelRoot);
          const newCenter = newBox.getCenter(new THREE.Vector3());
          this.controls.target.copy(newCenter);
          this.camera.position.set(
            newCenter.x + 5,
            newCenter.y + 3,
            newCenter.z + 5
          );
          this.controls.update();

          this.model.updateMatrixWorld(true);
          this.modelRoot.updateMatrixWorld(true);

          resolve({ model: this.model, transform: this.modelTransform });
        },
        (progress) => {
        },
        (error) => {
          console.error('Error loading model:', error);
          reject(error);
        }
      );
    });
  }

  addAnnotationMarkers(annotations) {
    annotations.forEach(ann => this.addAnnotationMarker(ann));
  }

  worldToLocal(worldPoint) {
    if (!this.model) return worldPoint.clone();

    const local = new THREE.Vector3();
    const worldVec = new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z);

    const inverseMatrix = new THREE.Matrix4();
    inverseMatrix.copy(this.model.matrixWorld).invert();
    local.copy(worldVec).applyMatrix4(inverseMatrix);

    return local;
  }

  localToWorld(localPoint) {
    if (!this.model) return localPoint.clone();

    const world = new THREE.Vector3();
    const localVec = new THREE.Vector3(localPoint.x, localPoint.y, localPoint.z);

    world.copy(localVec).applyMatrix4(this.model.matrixWorld);

    return world;
  }

  getModelTransform() {
    return { ...this.modelTransform };
  }

  applyModelTransform(transform) {
    if (!this.model || !transform) return;

    if (transform.scale !== undefined) {
      this.model.scale.setScalar(transform.scale);
      this.modelTransform.scale = transform.scale;
    }

    if (transform.centerOffset) {
      this.model.position.set(
        transform.centerOffset.x !== undefined ? transform.centerOffset.x : this.model.position.x,
        transform.centerOffset.y !== undefined ? transform.centerOffset.y : this.model.position.y,
        transform.centerOffset.z !== undefined ? transform.centerOffset.z : this.model.position.z
      );
      this.modelTransform.centerOffset = { ...transform.centerOffset };
    }

    this.model.updateMatrixWorld(true);
    this.modelTransform.normalized = true;
  }

  addAnnotationMarker(annotation) {
    let worldPosition;

    if (annotation.local_position_x !== undefined &&
        annotation.local_position_y !== undefined &&
        annotation.local_position_z !== undefined) {
      const localPos = new THREE.Vector3(
        annotation.local_position_x,
        annotation.local_position_y,
        annotation.local_position_z
      );
      worldPosition = this.localToWorld(localPos);
    } else {
      worldPosition = new THREE.Vector3(
        annotation.position_x,
        annotation.position_y,
        annotation.position_z
      );
    }

    const marker = new AnnotationMarker(
      annotation.id,
      worldPosition,
      annotation.user_color || '#f44336',
      annotation.resolved
    );

    this.scene.add(marker.getObject());
    this.annotationMarkers.set(annotation.id, marker);

    marker.onClick = () => {
      this._emit('annotation-click', annotation);
    };
  }

  getIntersectionLocalPosition(intersect) {
    if (!intersect || !intersect.point) return null;
    return this.worldToLocal(intersect.point);
  }

  updateAnnotationMarker(annotation) {
    const marker = this.annotationMarkers.get(annotation.id);
    if (marker) {
      marker.setResolved(annotation.resolved);
      if (annotation.user_color) {
        marker.setColor(annotation.user_color);
      }
    }
  }

  removeAnnotationMarker(id) {
    const marker = this.annotationMarkers.get(id);
    if (marker) {
      this.scene.remove(marker.getObject());
      marker.dispose();
      this.annotationMarkers.delete(id);
    }
  }

  updateRemoteCamera(sessionId, cameraData) {
    let remoteCam = this.remoteCameras.get(sessionId);

    if (!remoteCam) {
      remoteCam = {
        frustum: new THREE.CameraHelper(new THREE.PerspectiveCamera(60, 1, 0.1, 10), 0x667eea)
      };
      this.scene.add(remoteCam.frustum);
      this.remoteCameras.set(sessionId, remoteCam);
    }

    if (cameraData.position && cameraData.target && cameraData.up) {
      const pos = new THREE.Vector3(cameraData.position.x, cameraData.position.y, cameraData.position.z);
      const tgt = new THREE.Vector3(cameraData.target.x, cameraData.target.y, cameraData.target.z);
      const up = new THREE.Vector3(cameraData.up.x, cameraData.up.y, cameraData.up.z);

      remoteCam.frustum.camera.position.copy(pos);
      remoteCam.frustum.camera.up.copy(up);
      remoteCam.frustum.camera.lookAt(tgt);
      remoteCam.frustum.camera.updateProjectionMatrix();
      remoteCam.frustum.visible = true;
    }
  }

  removeRemoteCamera(sessionId) {
    const remoteCam = this.remoteCameras.get(sessionId);
    if (remoteCam) {
      this.scene.remove(remoteCam.frustum);
      this.remoteCameras.delete(sessionId);
    }
  }

  getCameraView() {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      target: {
        x: this.controls.target.x,
        y: this.controls.target.y,
        z: this.controls.target.z
      },
      up: {
        x: this.camera.up.x,
        y: this.camera.up.y,
        z: this.camera.up.z
      },
      fov: this.camera.fov
    };
  }

  setCameraView(view) {
    if (view.position) {
      this.camera.position.set(view.position.x, view.position.y, view.position.z);
    }
    if (view.target) {
      this.controls.target.set(view.target.x, view.target.y, view.target.z);
    }
    if (view.up) {
      this.camera.up.set(view.up.x, view.up.y, view.up.z);
    }
    if (view.fov) {
      this.camera.fov = view.fov;
      this.camera.updateProjectionMatrix();
    }
    this.controls.update();
  }

  showPlacementPreview(position) {
    this.clearPlacementPreview();
    this.placementPreview = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x667eea, transparent: true, opacity: 0.8 })
    );
    this.placementPreview.position.copy(position);
    this.scene.add(this.placementPreview);
  }

  clearPlacementPreview() {
    if (this.placementPreview) {
      this.scene.remove(this.placementPreview);
      this.placementPreview.geometry.dispose();
      this.placementPreview.material.dispose();
      this.placementPreview = null;
    }
  }

  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  _emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(cb => cb(data));
    }
  }

  _onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _onClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const markerMeshes = [];
    this.annotationMarkers.forEach(marker => {
      const mesh = marker.getClickMesh();
      if (mesh) markerMeshes.push(mesh);
    });

    const markerIntersects = this.raycaster.intersectObjects(markerMeshes, true);
    if (markerIntersects.length > 0) {
      const clickedMesh = markerIntersects[0].object;
      const markerId = clickedMesh.userData.markerId;
      if (markerId && this.annotationMarkers.has(markerId)) {
        this.annotationMarkers.get(markerId).onClick?.();
      }
      return;
    }

    if (this.model) {
      const modelIntersects = this.raycaster.intersectObject(this.model, true);
      if (modelIntersects.length > 0) {
        const intersect = modelIntersects[0];
        const localPosition = this.worldToLocal(intersect.point);
        this._emit('model-click', {
          ...intersect,
          worldPosition: intersect.point.clone(),
          localPosition: localPosition
        });
      } else {
        this._emit('model-click', null);
      }
    }
  }

  _onMouseMove(event) {
  }

  _animate() {
    this.animationId = requestAnimationFrame(() => this._animate());
    const delta = this.clock.getDelta();

    this.annotationMarkers.forEach(marker => {
      marker.update(delta);
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    this.annotationMarkers.forEach(marker => {
      this.scene.remove(marker.getObject());
      marker.dispose();
    });
    this.annotationMarkers.clear();

    this.remoteCameras.forEach(remoteCam => {
      this.scene.remove(remoteCam.frustum);
    });
    this.remoteCameras.clear();

    this.clearPlacementPreview();

    if (this.modelRoot) {
      this.scene.remove(this.modelRoot);
    }

    this.controls.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }

    window.removeEventListener('resize', () => this._onResize());
  }
}
