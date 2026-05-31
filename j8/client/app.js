import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class DrawingApp {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.plane = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.isDrawing = false;
    this.currentLine = null;
    this.currentLineId = null;
    this.currentPoints = [];
    this.userLines = new Map();
    this.remoteLines = new Map();
    this.lastPoint = null;
    this.lineOffset = 0.02;
    
    this.ws = null;
    this.userId = null;
    this.userColor = 0x4ecdc4;
    this.roomId = 'default';
    this.users = new Map();
    
    this.isVRMode = false;
    this.vrController1 = null;
    this.vrController2 = null;
    this.vrLinePoints = [];
    this.isVRDrawing = false;
    
    this.messageQueue = [];
    this.isWSReady = false;
    
    this.model = null;
    this.modelData = null;
    this.isDraggingModel = false;
    this.modelDragOffset = new THREE.Vector3();
    this.isScalingModel = false;
    this.lastScaleDistance = 0;
    
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = new THREE.Quaternion();
    this.targetScale = new THREE.Vector3(1, 1, 1);
    this.lerpFactor = 0.1;
    
    this.modelTransformTimeout = null;
    this.lastTransformTime = 0;
    this.transformThrottle = 50;
    
    this.gltfLoader = new GLTFLoader();
    
    this.init();
    this.setupWebSocket();
    this.setupEventListeners();
    this.animate();
  }
  
  generateLineId() {
    return 'line_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.xr.enabled = true;
    document.getElementById('container').appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
    
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
    gridHelper.position.y = -0.001;
    this.scene.add(gridHelper);
    
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x2a2a4e,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: true
    });
    this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.plane.rotation.x = -Math.PI / 2;
    this.plane.name = 'drawingPlane';
    this.scene.add(this.plane);
    
    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);
    
    this.createModelBoundingBox();
  }
  
  createModelBoundingBox() {
    const boxGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const boxMaterial = new THREE.MeshBasicMaterial({
      color: 0x4ecdc4,
      transparent: true,
      opacity: 0.3,
      wireframe: true
    });
    this.modelBoundingBox = new THREE.Mesh(boxGeometry, boxMaterial);
    this.modelBoundingBox.visible = false;
    this.modelBoundingBox.name = 'modelPlaceholder';
    this.scene.add(this.modelBoundingBox);
  }
  
  setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    this.ws.onopen = () => {
      this.updateStatus('已连接');
      this.isWSReady = true;
      this.flushMessageQueue();
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onclose = () => {
      this.updateStatus('连接断开');
      this.isWSReady = false;
    };
    
    this.ws.onerror = () => {
      this.updateStatus('连接错误');
      this.isWSReady = false;
    };
  }
  
  sendMessage(message) {
    if (this.isWSReady && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }
  
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        this.messageQueue.unshift(message);
        break;
      }
    }
  }
  
  handleMessage(message) {
    switch (message.type) {
      case 'joined':
        this.userId = message.userId;
        this.userColor = message.color;
        this.roomId = message.roomId;
        this.updateMyColor();
        message.users.forEach(user => {
          this.users.set(user.userId, user.color);
        });
        this.updateUserCount();
        
        if (message.modelData) {
          this.loadModelFromData(message.modelData);
          if (message.modelTransform) {
            this.setModelTransform(message.modelTransform, true);
          }
        }
        break;
        
      case 'userJoined':
        this.users.set(message.userId, message.color);
        this.updateUserCount();
        
        if (this.modelData) {
          this.sendMessage({
            type: 'modelSync',
            targetUserId: message.userId,
            modelData: this.modelData,
            modelTransform: this.getModelTransform()
          });
        }
        break;
        
      case 'userLeft':
        this.users.delete(message.userId);
        this.updateUserCount();
        break;
        
      case 'drawStart':
        if (message.userId !== this.userId) {
          this.startRemoteLine(message.userId, message.lineId, message.color, message.point);
        }
        break;
        
      case 'drawPoint':
        if (message.userId !== this.userId) {
          this.addPointToRemoteLine(message.userId, message.lineId, message.point);
        }
        break;
        
      case 'drawEnd':
        if (message.userId !== this.userId) {
          this.endRemoteLine(message.userId, message.lineId);
        }
        break;
        
      case 'clear':
        this.clearRemoteLines(message.userId);
        break;
        
      case 'modelUpload':
        if (message.userId !== this.userId) {
          this.loadModelFromData(message.modelData);
        }
        break;
        
      case 'modelSync':
        if (message.targetUserId === this.userId && !this.model) {
          this.loadModelFromData(message.modelData);
          if (message.modelTransform) {
            this.setModelTransform(message.modelTransform, true);
          }
        }
        break;
        
      case 'modelTransform':
        if (message.userId !== this.userId) {
          this.setModelTransform(message.transform, false);
        }
        break;
    }
  }
  
  joinRoom(roomId) {
    this.roomId = roomId;
    this.sendMessage({
      type: 'join',
      roomId: roomId
    });
  }
  
  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
    
    this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.renderer.domElement.addEventListener('mouseleave', (e) => this.onMouseUp(e));
    this.renderer.domElement.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    
    document.getElementById('joinBtn').addEventListener('click', () => {
      const roomId = document.getElementById('roomId').value.trim() || 'default';
      this.joinRoom(roomId);
    });
    
    document.getElementById('clearBtn').addEventListener('click', () => {
      this.clearMyLines();
      this.sendClear();
    });
    
    document.getElementById('vrBtn').addEventListener('click', () => {
      this.enterVR();
    });
    
    document.getElementById('resetViewBtn').addEventListener('click', () => {
      this.resetView();
    });
    
    document.getElementById('modelUpload').addEventListener('change', (e) => {
      this.handleModelUpload(e);
    });
    
    this.setupVRControllers();
  }
  
  handleModelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      this.parseAndLoadGLTF(arrayBuffer, file.name);
    };
    reader.readAsArrayBuffer(file);
  }
  
  parseAndLoadGLTF(arrayBuffer, fileName) {
    const base64Data = btoa(
      new Uint8Array(arrayBuffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    this.modelData = {
      name: fileName,
      data: base64Data
    };
    
    this.gltfLoader.parse(arrayBuffer, '', (gltf) => {
      this.addModelToScene(gltf.scene);
      this.sendMessage({
        type: 'modelUpload',
        modelData: this.modelData
      });
    }, (error) => {
      console.error('Error loading GLTF:', error);
      alert('模型加载失败，请检查文件格式');
    });
  }
  
  loadModelFromData(modelData) {
    this.modelData = modelData;
    
    const binaryString = atob(modelData.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;
    
    this.gltfLoader.parse(arrayBuffer, '', (gltf) => {
      this.addModelToScene(gltf.scene);
    }, (error) => {
      console.error('Error loading GLTF:', error);
    });
  }
  
  addModelToScene(modelScene) {
    if (this.model) {
      this.scene.remove(this.model);
    }
    
    this.model = modelScene;
    this.model.position.set(0, 0, 0);
    this.model.scale.set(1, 1, 1);
    this.targetPosition.copy(this.model.position);
    this.targetRotation.copy(this.model.quaternion);
    this.targetScale.copy(this.model.scale);
    
    this.scene.add(this.model);
    
    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    this.model.position.sub(center);
    this.model.position.y = size.y / 2;
    this.targetPosition.copy(this.model.position);
    
    this.updateModelBoundingBox();
  }
  
  updateModelBoundingBox() {
    if (!this.model) return;
    
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    this.modelBoundingBox.scale.copy(size);
    this.modelBoundingBox.position.copy(center);
    this.modelBoundingBox.visible = true;
  }
  
  getModelTransform() {
    if (!this.model) return null;
    return {
      position: {
        x: this.model.position.x,
        y: this.model.position.y,
        z: this.model.position.z
      },
      rotation: {
        x: this.model.quaternion.x,
        y: this.model.quaternion.y,
        z: this.model.quaternion.z,
        w: this.model.quaternion.w
      },
      scale: {
        x: this.model.scale.x,
        y: this.model.scale.y,
        z: this.model.scale.z
      }
    };
  }
  
  setModelTransform(transform, immediate = false) {
    if (!this.model) return;
    
    this.targetPosition.set(transform.position.x, transform.position.y, transform.position.z);
    this.targetRotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
    this.targetScale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    
    if (immediate) {
      this.model.position.copy(this.targetPosition);
      this.model.quaternion.copy(this.targetRotation);
      this.model.scale.copy(this.targetScale);
      this.updateModelBoundingBox();
    }
  }
  
  sendModelTransform() {
    const now = Date.now();
    if (now - this.lastTransformTime < this.transformThrottle) return;
    this.lastTransformTime = now;
    
    const transform = this.getModelTransform();
    if (transform) {
      this.sendMessage({
        type: 'modelTransform',
        transform: transform
      });
    }
  }
  
  resetView() {
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  
  setupVRControllers() {
    this.vrController1 = this.renderer.xr.getController(0);
    this.vrController2 = this.renderer.xr.getController(1);
    
    const onSelectStart = (event) => {
      this.isVRDrawing = true;
      this.vrLinePoints = [];
      this.currentLineId = this.generateLineId();
    };
    
    const onSelectEnd = (event) => {
      if (this.vrLinePoints.length > 1) {
        this.sendLineEnd(this.currentLineId);
      } else {
        if (this.currentLine) {
          this.scene.remove(this.currentLine);
          this.currentLine = null;
        }
      }
      this.isVRDrawing = false;
      this.currentLine = null;
      this.vrLinePoints = [];
      this.currentLineId = null;
    };
    
    this.vrController1.addEventListener('selectstart', onSelectStart);
    this.vrController1.addEventListener('selectend', onSelectEnd);
    this.vrController2.addEventListener('selectstart', onSelectStart);
    this.vrController2.addEventListener('selectend', onSelectEnd);
    
    this.scene.add(this.vrController1);
    this.scene.add(this.vrController2);
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -0.5)
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const pointerLine1 = new THREE.Line(lineGeometry, lineMaterial);
    const pointerLine2 = new THREE.Line(lineGeometry, lineMaterial);
    this.vrController1.add(pointerLine1);
    this.vrController2.add(pointerLine2);
  }
  
  enterVR() {
    if (this.renderer.xr.isPresenting) {
      this.renderer.xr.endSession();
      this.isVRMode = false;
      document.getElementById('vrBtn').textContent = '进入 VR 模式';
    } else {
      if (navigator.xr) {
        navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'bounded-floor']
        }).then((session) => {
          this.renderer.xr.setSession(session);
          this.isVRMode = true;
          document.getElementById('vrBtn').textContent = '退出 VR 模式';
          
          session.addEventListener('end', () => {
            this.isVRMode = false;
            document.getElementById('vrBtn').textContent = '进入 VR 模式';
          });
        }).catch((err) => {
          console.error('VR 不支持:', err);
          alert('VR 不可用，请确保连接了 VR 设备并使用支持 WebXR 的浏览器');
        });
      } else {
        alert('您的浏览器不支持 WebXR');
      }
    }
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  getIntersectionPoint(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const intersects = this.raycaster.intersectObject(this.plane);
    
    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }
  
  getModelIntersection(event) {
    if (!this.model) return null;
    
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const intersects = this.raycaster.intersectObject(this.model, true);
    
    if (intersects.length > 0) {
      return intersects[0];
    }
    return null;
  }
  
  onMouseDown(event) {
    if (event.button !== 0) return;
    if (this.isVRMode) return;
    
    const modelIntersect = this.getModelIntersection(event);
    if (modelIntersect) {
      this.isDraggingModel = true;
      const planePoint = this.getIntersectionPoint(event);
      if (planePoint) {
        this.modelDragOffset.copy(this.model.position).sub(planePoint);
      }
      this.controls.enabled = false;
      return;
    }
    
    const point = this.getIntersectionPoint(event);
    if (point) {
      this.isDrawing = true;
      this.currentLineId = this.generateLineId();
      point.y = this.lineOffset;
      this.currentPoints = [point.clone()];
      this.lastPoint = point.clone();
      this.createNewLine();
      this.sendLineStart(this.currentLineId, point);
    }
  }
  
  onMouseMove(event) {
    if (this.isVRMode) return;
    
    if (this.isDraggingModel && this.model) {
      const planePoint = this.getIntersectionPoint(event);
      if (planePoint) {
        const newPos = planePoint.clone().add(this.modelDragOffset);
        newPos.y = this.model.position.y;
        this.model.position.copy(newPos);
        this.targetPosition.copy(newPos);
        this.updateModelBoundingBox();
        this.sendModelTransform();
      }
      return;
    }
    
    if (!this.isDrawing) return;
    
    const point = this.getIntersectionPoint(event);
    if (point && this.lastPoint) {
      point.y = this.lineOffset;
      const distance = point.distanceTo(this.lastPoint);
      if (distance > 0.05) {
        this.currentPoints.push(point.clone());
        this.updateCurrentLine();
        this.sendLinePoint(this.currentLineId, point);
        this.lastPoint = point.clone();
      }
    }
  }
  
  onMouseUp(event) {
    if (event.button !== 0) return;
    if (this.isVRMode) return;
    
    if (this.isDraggingModel) {
      this.isDraggingModel = false;
      this.controls.enabled = true;
      return;
    }
    
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    
    if (this.currentPoints.length <= 1) {
      if (this.currentLine) {
        this.scene.remove(this.currentLine);
      }
    }
    
    this.sendLineEnd(this.currentLineId);
    this.currentLine = null;
    this.currentPoints = [];
    this.lastPoint = null;
    this.currentLineId = null;
  }
  
  onWheel(event) {
    if (!this.model || this.isVRMode) return;
    
    const modelIntersect = this.getModelIntersection(event);
    if (!modelIntersect) return;
    
    event.preventDefault();
    
    const scaleFactor = event.deltaY > 0 ? 0.95 : 1.05;
    const newScale = this.model.scale.clone().multiplyScalar(scaleFactor);
    
    if (newScale.x > 0.1 && newScale.x < 10) {
      this.model.scale.copy(newScale);
      this.targetScale.copy(newScale);
      this.updateModelBoundingBox();
      this.sendModelTransform();
    }
  }
  
  createNewLine() {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color: this.userColor,
      linewidth: 2,
      opacity: 0.9,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });
    
    this.currentLine = new THREE.Line(geometry, material);
    this.currentLine.renderOrder = 1;
    this.scene.add(this.currentLine);
    
    if (!this.userLines.has(this.userId)) {
      this.userLines.set(this.userId, []);
    }
    this.userLines.get(this.userId).push(this.currentLine);
  }
  
  updateCurrentLine() {
    if (!this.currentLine || this.currentPoints.length < 2) return;
    
    const positions = new Float32Array(this.currentPoints.length * 3);
    for (let i = 0; i < this.currentPoints.length; i++) {
      positions[i * 3] = this.currentPoints[i].x;
      positions[i * 3 + 1] = this.currentPoints[i].y;
      positions[i * 3 + 2] = this.currentPoints[i].z;
    }
    
    this.currentLine.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    this.currentLine.geometry.computeBoundingSphere();
  }
  
  startRemoteLine(userId, lineId, color, point) {
    const threePoint = new THREE.Vector3(point.x, this.lineOffset, point.z);
    
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      opacity: 0.9,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });
    
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 1;
    this.scene.add(line);
    
    const userRemoteLines = this.remoteLines.get(userId) || new Map();
    userRemoteLines.set(lineId, {
      line: line,
      points: [threePoint]
    });
    this.remoteLines.set(userId, userRemoteLines);
    
    if (!this.userLines.has(userId)) {
      this.userLines.set(userId, []);
    }
    this.userLines.get(userId).push(line);
  }
  
  addPointToRemoteLine(userId, lineId, point) {
    const userRemoteLines = this.remoteLines.get(userId);
    if (!userRemoteLines) return;
    
    const lineData = userRemoteLines.get(lineId);
    if (!lineData) return;
    
    const threePoint = new THREE.Vector3(point.x, this.lineOffset, point.z);
    lineData.points.push(threePoint);
    
    if (lineData.points.length >= 2) {
      const positions = new Float32Array(lineData.points.length * 3);
      for (let i = 0; i < lineData.points.length; i++) {
        positions[i * 3] = lineData.points[i].x;
        positions[i * 3 + 1] = lineData.points[i].y;
        positions[i * 3 + 2] = lineData.points[i].z;
      }
      lineData.line.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      );
      lineData.line.geometry.computeBoundingSphere();
    }
  }
  
  endRemoteLine(userId, lineId) {
    const userRemoteLines = this.remoteLines.get(userId);
    if (!userRemoteLines) return;
    
    const lineData = userRemoteLines.get(lineId);
    if (!lineData) return;
    
    if (lineData.points.length < 2) {
      this.scene.remove(lineData.line);
      const lines = this.userLines.get(userId) || [];
      const idx = lines.indexOf(lineData.line);
      if (idx > -1) lines.splice(idx, 1);
      if (lineData.line.geometry) lineData.line.geometry.dispose();
      if (lineData.line.material) lineData.line.material.dispose();
    }
    
    userRemoteLines.delete(lineId);
  }
  
  sendLineStart(lineId, point) {
    this.sendMessage({
      type: 'drawStart',
      lineId: lineId,
      point: { x: point.x, y: point.y, z: point.z }
    });
  }
  
  sendLinePoint(lineId, point) {
    this.sendMessage({
      type: 'drawPoint',
      lineId: lineId,
      point: { x: point.x, y: point.y, z: point.z }
    });
  }
  
  sendLineEnd(lineId) {
    this.sendMessage({
      type: 'drawEnd',
      lineId: lineId
    });
  }
  
  clearMyLines() {
    const lines = this.userLines.get(this.userId) || [];
    lines.forEach(line => {
      this.scene.remove(line);
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    });
    this.userLines.set(this.userId, []);
    this.remoteLines.delete(this.userId);
  }
  
  clearRemoteLines(userId) {
    const lines = this.userLines.get(userId) || [];
    lines.forEach(line => {
      this.scene.remove(line);
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    });
    this.userLines.set(userId, []);
    this.remoteLines.delete(userId);
  }
  
  sendClear() {
    this.sendMessage({
      type: 'clear'
    });
  }
  
  updateStatus(text) {
    document.getElementById('status').textContent = text;
  }
  
  updateMyColor() {
    const colorHex = '#' + this.userColor.toString(16).padStart(6, '0');
    document.getElementById('myColor').style.backgroundColor = colorHex;
  }
  
  updateUserCount() {
    document.getElementById('userCount').textContent = this.users.size;
  }
  
  updateVRDrawing() {
    if (!this.isVRMode || !this.renderer.xr.isPresenting) return;
    
    const controller = this.vrController1.visible ? this.vrController1 : 
                       (this.vrController2.visible ? this.vrController2 : null);
    
    if (!controller) return;
    
    const worldPos = new THREE.Vector3();
    controller.getWorldPosition(worldPos);
    
    const planeY = 0;
    if (Math.abs(worldPos.y - planeY) < 0.1) {
      const projectedPoint = new THREE.Vector3(worldPos.x, this.lineOffset, worldPos.z);
      
      if (this.isVRDrawing) {
        if (this.vrLinePoints.length === 0) {
          this.vrLinePoints.push(projectedPoint);
          this.lastPoint = projectedPoint.clone();
          this.createNewLine();
          this.sendLineStart(this.currentLineId, projectedPoint);
        } else {
          const distance = projectedPoint.distanceTo(this.lastPoint);
          if (distance > 0.05) {
            this.vrLinePoints.push(projectedPoint);
            this.currentPoints = this.vrLinePoints;
            this.updateCurrentLine();
            this.sendLinePoint(this.currentLineId, projectedPoint);
            this.lastPoint = projectedPoint.clone();
          }
        }
      }
    }
  }
  
  updateModelInterpolation() {
    if (!this.model || this.isDraggingModel) return;
    
    this.model.position.lerp(this.targetPosition, this.lerpFactor);
    this.model.quaternion.slerp(this.targetRotation, this.lerpFactor);
    this.model.scale.lerp(this.targetScale, this.lerpFactor);
    
    this.updateModelBoundingBox();
  }
  
  animate() {
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.updateVRDrawing();
      this.updateModelInterpolation();
      this.renderer.render(this.scene, this.camera);
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new DrawingApp();
});
