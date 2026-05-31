import * as THREE from 'three';

class FirstPersonControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.pitch = 0;
    this.yaw = 0;
    this.position = new THREE.Vector3(0, 20, 0);

    this.keys = {};
    this.velocity = new THREE.Vector3();
    this.onGround = false;

    this.moveSpeed = 6;
    this.jumpSpeed = 8;
    this.gravity = 22;
    this.mouseSensitivity = 0.002;
    this.playerHeight = 1.7;
    this.playerRadius = 0.3;

    this.isLocked = false;
    this.world = null;

    this.onLockChange = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  _onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
    if (this.onLockChange) {
      this.onLockChange(this.isLocked);
    }
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  _onMouseMove(e) {
    if (!this.isLocked) return;
    this.yaw -= e.movementX * this.mouseSensitivity;
    this.pitch -= e.movementY * this.mouseSensitivity;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
  }

  setWorld(world) {
    this.world = world;
  }

  update(dt) {
    if (!this.isLocked) return;

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const moveDir = new THREE.Vector3();
    if (this.keys['KeyW']) moveDir.add(forward);
    if (this.keys['KeyS']) moveDir.sub(forward);
    if (this.keys['KeyD']) moveDir.add(right);
    if (this.keys['KeyA']) moveDir.sub(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize().multiplyScalar(this.moveSpeed);
    }

    this.velocity.x = moveDir.x;
    this.velocity.z = moveDir.z;

    if (this.keys['Space'] && this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }

    this.velocity.y -= this.gravity * dt;

    const newPos = this.position.clone();
    newPos.x += this.velocity.x * dt;
    newPos.y += this.velocity.y * dt;
    newPos.z += this.velocity.z * dt;

    if (this.world) {
      const feetY = newPos.y - this.playerHeight;
      const headY = newPos.y + 0.1;

      const bx = Math.floor(newPos.x);
      const bz = Math.floor(newPos.z);

      const blockBelowFeet = this.world.getBlock(bx, Math.floor(feetY), bz);
      const blockBelowHead = this.world.getBlock(bx, Math.floor(feetY) + 1, bz);

      if (blockBelowFeet !== 0 || blockBelowHead !== 0) {
        const groundLevel = Math.floor(feetY);
        if (this.velocity.y < 0) {
          newPos.y = groundLevel + 1 + this.playerHeight;
          this.velocity.y = 0;
          this.onGround = true;
        }
      } else {
        this.onGround = false;
      }

      for (let checkY = Math.floor(this.position.y - this.playerHeight); checkY <= Math.floor(this.position.y); checkY++) {
        if (this.world.getBlock(Math.floor(newPos.x), checkY, Math.floor(this.position.z)) !== 0) {
          newPos.x = this.position.x;
          this.velocity.x = 0;
          break;
        }
      }

      for (let checkY = Math.floor(this.position.y - this.playerHeight); checkY <= Math.floor(this.position.y); checkY++) {
        if (this.world.getBlock(Math.floor(this.position.x), checkY, Math.floor(newPos.z)) !== 0) {
          newPos.z = this.position.z;
          this.velocity.z = 0;
          break;
        }
      }
    }

    this.position.copy(newPos);

    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  getDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return dir.normalize();
  }
}

export { FirstPersonControls };
