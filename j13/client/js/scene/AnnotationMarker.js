import * as THREE from 'three';

export class AnnotationMarker {
  constructor(id, position, color = '#f44336', resolved = false) {
    this.id = id;
    this.position = position.clone();
    this.color = new THREE.Color(color);
    this.resolved = resolved;
    this.onClick = null;
    this._pulseTime = 0;

    this._buildMarker();
  }

  _buildMarker() {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const baseColor = this.resolved ? 0x4CAF50 : this.color;

    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.9
      })
    );
    this.sphere.userData.markerId = this.id;
    this.group.add(this.sphere);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.12, 32),
      new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.ring);

    this.stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8),
      new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.6
      })
    );
    this.stem.position.y = -0.15;
    this.group.add(this.stem);

    if (this.resolved) {
      const checkMark = this._createCheckMark();
      checkMark.position.y = 0.02;
      this.group.add(checkMark);
    }
  }

  _createCheckMark() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.04, 0);
    shape.lineTo(-0.01, 0.03);
    shape.lineTo(0.04, -0.03);

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });

    return new THREE.Mesh(geometry, material);
  }

  setResolved(resolved) {
    this.resolved = resolved;
    const baseColor = resolved ? 0x4CAF50 : this.color;

    this.sphere.material.color.setHex(baseColor);
    this.ring.material.color.setHex(baseColor);
    this.stem.material.color.setHex(baseColor);

    if (resolved) {
      const existingCheck = this.group.children.find(c => c.geometry && c.geometry.type === 'ShapeGeometry');
      if (!existingCheck) {
        const checkMark = this._createCheckMark();
        checkMark.position.y = 0.02;
        this.group.add(checkMark);
      }
    } else {
      const toRemove = [];
      this.group.children.forEach(child => {
        if (child.geometry && child.geometry.type === 'ShapeGeometry') {
          toRemove.push(child);
        }
      });
      toRemove.forEach(child => {
        this.group.remove(child);
        child.geometry.dispose();
        child.material.dispose();
      });
    }
  }

  setColor(color) {
    this.color = new THREE.Color(color);
    if (!this.resolved) {
      const hex = this.color.getHex();
      this.sphere.material.color.setHex(hex);
      this.ring.material.color.setHex(hex);
      this.stem.material.color.setHex(hex);
    }
  }

  getObject() {
    return this.group;
  }

  getClickMesh() {
    return this.sphere;
  }

  update(delta) {
    this._pulseTime += delta;

    const pulseScale = 1 + Math.sin(this._pulseTime * 3) * 0.1;
    this.sphere.scale.setScalar(pulseScale);

    const ringScale = 1 + Math.sin(this._pulseTime * 2 + 0.5) * 0.2;
    this.ring.scale.setScalar(ringScale);
    this.ring.material.opacity = 0.3 + Math.sin(this._pulseTime * 2) * 0.2;

    this.group.position.y = this.position.y + Math.sin(this._pulseTime * 2) * 0.01;
  }

  dispose() {
    this.sphere.geometry.dispose();
    this.sphere.material.dispose();
    this.ring.geometry.dispose();
    this.ring.material.dispose();
    this.stem.geometry.dispose();
    this.stem.material.dispose();

    this.group.children.forEach(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}
