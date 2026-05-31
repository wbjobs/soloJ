import * as THREE from 'three';

class PlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map();
  }

  addPlayer(id, x, y, z) {
    if (this.players.has(id)) return;

    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.5, 1.0, 0.3);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4488ff });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    group.add(body);

    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffcc88 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.2;
    group.add(head);

    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = 256;
    nameCanvas.height = 64;
    const ctx = nameCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(id.replace('player_', 'P'), 128, 32);

    const nameTexture = new THREE.CanvasTexture(nameCanvas);
    const nameMat = new THREE.SpriteMaterial({ map: nameTexture, transparent: true });
    const nameSprite = new THREE.Sprite(nameMat);
    nameSprite.position.y = 1.8;
    nameSprite.scale.set(1.5, 0.4, 1);
    group.add(nameSprite);

    group.position.set(x, y, z);
    this.scene.add(group);
    this.players.set(id, { group, x, y, z, targetX: x, targetY: y, targetZ: z });
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (player) {
      this.scene.remove(player.group);
      player.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      this.players.delete(id);
    }
  }

  updatePlayerPosition(id, x, y, z, rx, ry) {
    const player = this.players.get(id);
    if (player) {
      player.targetX = x;
      player.targetY = y;
      player.targetZ = z;
      player.targetRX = rx;
      player.targetRY = ry;
    }
  }

  update(dt) {
    for (const [id, player] of this.players) {
      const lerpFactor = 1 - Math.pow(0.001, dt);
      player.x += (player.targetX - player.x) * lerpFactor;
      player.y += (player.targetY - player.y) * lerpFactor;
      player.z += (player.targetZ - player.z) * lerpFactor;
      player.group.position.set(player.x, player.y, player.z);

      if (player.targetRY !== undefined) {
        player.group.rotation.y = player.targetRY;
      }
    }
  }

  getPlayerCount() {
    return this.players.size;
  }
}

export { PlayerManager };
