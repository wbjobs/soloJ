import * as THREE from 'three';
import { ClientWorld, BLOCK, CHUNK_SIZE } from './world.js';
import { FirstPersonControls } from './controls.js';
import { Network } from './network.js';
import { PlayerManager } from './playerManager.js';

const WS_URL = `ws://${window.location.host}/ws`;

let scene, camera, renderer, controls, world, network, playerManager;
let selectedBlock = BLOCK.GRASS;
let isPlaying = false;
let lastTime = performance.now();
let moveSendTimer = 0;

const highlightGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
const highlightMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.15,
  depthTest: true,
  wireframe: false,
});
const highlightWireMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
  transparent: true,
  opacity: 0.5,
});
let highlightMesh, highlightWireMesh;

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 40, 80);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = false;
  document.body.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xccccff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfff4e6, 1.0);
  dirLight.position.set(50, 80, 30);
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.4);
  scene.add(hemiLight);

  world = new ClientWorld();
  world.init(scene);

  controls = new FirstPersonControls(camera, renderer.domElement);
  controls.setWorld(world);

  playerManager = new PlayerManager(scene);

  network = new Network();
  network.onInit = handleInit;
  network.onPlayerJoin = handlePlayerJoin;
  network.onPlayerLeave = handlePlayerLeave;
  network.onPlayerMove = handlePlayerMove;
  network.onBlockChange = handleBlockChange;
  network.onBlockChangeAck = handleBlockChangeAck;
  network.onWorldRollback = handleWorldRollback;

  highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
  highlightMesh.visible = false;
  scene.add(highlightMesh);

  highlightWireMesh = new THREE.Mesh(highlightGeo, highlightWireMat);
  highlightWireMesh.visible = false;
  scene.add(highlightWireMesh);

  setupUI();
  connectToServer();
}

async function connectToServer() {
  const statusEl = document.getElementById('status');
  try {
    await network.connect(WS_URL);
    statusEl.textContent = '已连接！点击开始游戏';
    statusEl.style.color = '#4ade80';
    document.getElementById('play-btn').disabled = false;
  } catch (e) {
    statusEl.textContent = '连接失败，请确认服务器已启动';
    statusEl.style.color = '#ef4444';
  }
}

function handleInit(data) {
  world.loadChunks(data.world.chunks);

  for (const p of data.players) {
    playerManager.addPlayer(p.id, p.x, p.y, p.z);
  }

  controls.position.set(0, 20, 0);
  updatePlayerCount();
}

function handlePlayerJoin(data) {
  playerManager.addPlayer(data.id, data.x, data.y, data.z);
  updatePlayerCount();
}

function handlePlayerLeave(data) {
  playerManager.removePlayer(data.id);
  updatePlayerCount();
}

function handlePlayerMove(data) {
  playerManager.updatePlayerPosition(data.id, data.x, data.y, data.z, data.rx, data.ry);
}

function handleBlockChange(data) {
  world.setBlock(data.x, data.y, data.z, data.block);
}

function handleBlockChangeAck(data) {
  if (data.applied) {
    world.setBlock(data.x, data.y, data.z, data.block);
  }
}

let rollbackNotification = null;

function showRollbackNotification(timestamp) {
  if (rollbackNotification) {
    document.body.removeChild(rollbackNotification);
  }

  rollbackNotification = document.createElement('div');
  rollbackNotification.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(239, 68, 68, 0.95);
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 200;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    text-align: center;
    max-width: 90%;
  `;
  rollbackNotification.innerHTML = `
    <div style="font-size: 1.2em; margin-bottom: 4px;">⚠️ 世界已回滚</div>
    <div style="font-size: 0.9em; font-weight: normal; opacity: 0.9;">
      管理员将世界恢复到 ${new Date(timestamp).toLocaleString('zh-CN')}
    </div>
  `;
  document.body.appendChild(rollbackNotification);

  setTimeout(() => {
    if (rollbackNotification && rollbackNotification.parentNode) {
      rollbackNotification.style.transition = 'opacity 0.5s';
      rollbackNotification.style.opacity = '0';
      setTimeout(() => {
        if (rollbackNotification && rollbackNotification.parentNode) {
          document.body.removeChild(rollbackNotification);
        }
        rollbackNotification = null;
      }, 500);
    }
  }, 5000);
}

function handleWorldRollback(data) {
  console.log('World rollback received, timestamp:', data.timestamp);
  world.reloadWorld(data.chunks);
  showRollbackNotification(data.timestamp);
}

function updatePlayerCount() {
  const el = document.getElementById('player-count');
  if (el) el.textContent = `在线: ${playerManager.getPlayerCount() + 1}`;
}

function setupUI() {
  const playBtn = document.getElementById('play-btn');
  const blocker = document.getElementById('blocker');
  const crosshair = document.getElementById('crosshair');
  const hud = document.getElementById('hud');

  playBtn.addEventListener('click', () => {
    controls.lock();
  });

  controls.onLockChange = (locked) => {
    isPlaying = locked;
    blocker.style.display = locked ? 'none' : 'flex';
    crosshair.classList.toggle('visible', locked);
    hud.classList.toggle('visible', locked);
  };

  document.addEventListener('keydown', (e) => {
    if (!isPlaying) return;
    const num = parseInt(e.key);
    if (num >= 1 && num <= 5) {
      selectedBlock = num;
      updateBlockSelector();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!isPlaying) return;
    if (e.button === 0) {
      breakBlock();
    } else if (e.button === 2) {
      placeBlock();
    }
  });

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  const blockOptions = document.querySelectorAll('.block-option');
  blockOptions.forEach((opt) => {
    opt.addEventListener('click', () => {
      selectedBlock = parseInt(opt.dataset.block);
      updateBlockSelector();
    });
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function updateBlockSelector() {
  document.querySelectorAll('.block-option').forEach((opt) => {
    opt.classList.toggle('selected', parseInt(opt.dataset.block) === selectedBlock);
  });
}

const pendingBlockOps = new Set();

async function breakBlock() {
  if (pendingBlockOps.size > 3) return;
  const origin = camera.position.clone();
  const direction = controls.getDirection();
  const result = world.raycast(origin, direction);

  if (result.hit) {
    const { x, y, z } = result.blockPos;
    const opKey = `break_${x}_${y}_${z}`;
    if (pendingBlockOps.has(opKey)) return;
    pendingBlockOps.add(opKey);
    try {
      await network.sendBlockChange(x, y, z, BLOCK.AIR);
    } catch (e) {
      console.debug('Break block rejected:', e.message);
    } finally {
      pendingBlockOps.delete(opKey);
    }
  }
}

async function placeBlock() {
  if (pendingBlockOps.size > 3) return;
  const origin = camera.position.clone();
  const direction = controls.getDirection();
  const result = world.raycast(origin, direction);

  if (result.hit) {
    const pp = result.placePos;
    const playerFeetX = Math.floor(controls.position.x);
    const playerFeetZ = Math.floor(controls.position.z);
    const playerFeetY = Math.floor(controls.position.y - controls.playerHeight);
    const playerHeadY = Math.floor(controls.position.y);

    if (pp.x === playerFeetX && pp.z === playerFeetZ && pp.y >= playerFeetY && pp.y <= playerHeadY) {
      return;
    }

    const opKey = `place_${pp.x}_${pp.y}_${pp.z}_${selectedBlock}`;
    if (pendingBlockOps.has(opKey)) return;
    pendingBlockOps.add(opKey);
    try {
      await network.sendBlockChange(pp.x, pp.y, pp.z, selectedBlock);
    } catch (e) {
      console.debug('Place block rejected:', e.message);
    } finally {
      pendingBlockOps.delete(opKey);
    }
  }
}

function updateHighlight() {
  if (!isPlaying) {
    highlightMesh.visible = false;
    highlightWireMesh.visible = false;
    return;
  }

  const origin = camera.position.clone();
  const direction = controls.getDirection();
  const result = world.raycast(origin, direction);

  if (result.hit) {
    highlightMesh.visible = true;
    highlightWireMesh.visible = true;
    highlightMesh.position.set(result.blockPos.x + 0.5, result.blockPos.y + 0.5, result.blockPos.z + 0.5);
    highlightWireMesh.position.copy(highlightMesh.position);
  } else {
    highlightMesh.visible = false;
    highlightWireMesh.visible = false;
  }
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  controls.update(dt);
  playerManager.update(dt);
  updateHighlight();

  moveSendTimer += dt;
  if (moveSendTimer >= 0.05 && isPlaying) {
    moveSendTimer = 0;
    network.sendMove(
      controls.position.x,
      controls.position.y,
      controls.position.z,
      controls.pitch,
      controls.yaw,
    );
  }

  const coordsEl = document.getElementById('coords');
  if (coordsEl && isPlaying) {
    const p = controls.position;
    coordsEl.textContent = `X:${p.x.toFixed(1)} Y:${p.y.toFixed(1)} Z:${p.z.toFixed(1)}`;
  }

  renderer.render(scene, camera);
}

init();
animate();
