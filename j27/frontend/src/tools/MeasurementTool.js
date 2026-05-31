import * as THREE from 'three';
import { measurementVertexShader, measurementFragmentShader } from '../shaders/pointCloudShaders.js';

class MeasurementTool {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.points = [];
    this.active = false;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.pointMaterial = new THREE.ShaderMaterial({
      vertexShader: measurementVertexShader,
      fragmentShader: measurementFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(0xff4444) },
      },
      transparent: true,
      depthTest: false,
    });

    this.lineMaterial = new THREE.LineBasicMaterial({
      color: 0x4caf50,
      linewidth: 3,
      transparent: true,
      depthTest: false,
    });

    this.pointObjects = [];
    this.lineObjects = [];

    this.onPointAdded = null;
    this.onPointRemoved = null;
    this.onDistanceChanged = null;
  }

  activate() {
    this.active = true;
    this.clear();
  }

  deactivate() {
    this.active = false;
  }

  handleClick(event, domElement, pointCloudMeshes) {
    if (!this.active) return null;

    const rect = domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(pointCloudMeshes, true);

    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      this.addPoint(point);
      return point;
    }

    return null;
  }

  addPoint(point) {
    this.points.push(point);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([point.x, point.y, point.z], 3));

    const pointMesh = new THREE.Points(geometry, this.pointMaterial);
    this.scene.add(pointMesh);
    this.pointObjects.push(pointMesh);

    if (this.points.length > 1) {
      this._updateLines();
    }

    if (this.onPointAdded) {
      this.onPointAdded(point, this.points.length);
    }

    this._notifyDistanceChanged();
  }

  removeLastPoint() {
    if (this.points.length > 0) {
      this.points.pop();

      const pointMesh = this.pointObjects.pop();
      if (pointMesh) {
        this.scene.remove(pointMesh);
        pointMesh.geometry.dispose();
      }

      this._updateLines();

      if (this.onPointRemoved) {
        this.onPointRemoved(this.points.length);
      }

      this._notifyDistanceChanged();
    }
  }

  _updateLines() {
    for (const line of this.lineObjects) {
      this.scene.remove(line);
      line.geometry.dispose();
    }
    this.lineObjects = [];

    if (this.points.length < 2) return;

    for (let i = 0; i < this.points.length - 1; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        this.points[i].x, this.points[i].y, this.points[i].z,
        this.points[i + 1].x, this.points[i + 1].y, this.points[i + 1].z,
      ], 3));

      const line = new THREE.Line(geometry, this.lineMaterial);
      this.scene.add(line);
      this.lineObjects.push(line);
    }
  }

  getTotalDistance() {
    if (this.points.length < 2) return 0;

    let total = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      total += this.points[i].distanceTo(this.points[i + 1]);
    }
    return total;
  }

  getSegments() {
    const segments = [];
    for (let i = 0; i < this.points.length - 1; i++) {
      segments.push({
        start: this.points[i],
        end: this.points[i + 1],
        distance: this.points[i].distanceTo(this.points[i + 1]),
      });
    }
    return segments;
  }

  _notifyDistanceChanged() {
    if (this.onDistanceChanged) {
      this.onDistanceChanged(this.getTotalDistance(), this.getSegments());
    }
  }

  clear() {
    this.points = [];

    for (const pointMesh of this.pointObjects) {
      this.scene.remove(pointMesh);
      pointMesh.geometry.dispose();
    }
    this.pointObjects = [];

    for (const line of this.lineObjects) {
      this.scene.remove(line);
      line.geometry.dispose();
    }
    this.lineObjects = [];

    this._notifyDistanceChanged();
  }

  dispose() {
    this.clear();
    this.pointMaterial.dispose();
    this.lineMaterial.dispose();
  }
}

export default MeasurementTool;
