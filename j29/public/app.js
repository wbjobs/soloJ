let socket;
let peerConnection;
let token;
let selectedRobotId;
let isControlling = false;
let gripperState = true;
let scene, camera, renderer, robotMesh, armMeshes = [];

let commandSeq = 0;
let lastSentVelocity = { linear: 0, angular: 0 };
let lastSentArm = { position: { x: 0, y: 0, z: 0.5 }, gripper: true };
let velocitySendTimer = null;
let lastVelocitySendTime = 0;
const MIN_SEND_INTERVAL = 50;
const MAX_SEND_INTERVAL = 100;
let networkQuality = 'good';
let pingTimes = [];

let isRecording = false;
let isPlaying = false;
let trajectory = [];
let recordingStartTime = 0;
let playbackIndex = 0;
let playbackStartTime = 0;
let playbackTimer = null;

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            document.getElementById('loginError').textContent = data.error;
        } else {
            token = data.token;
            document.getElementById('currentUser').textContent = data.username;
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('controlScreen').classList.remove('hidden');
            initSocket();
            init3DVisualization();
            initJoystick();
        }
    })
    .catch(err => {
        document.getElementById('loginError').textContent = '登录失败';
    });
}

function logout() {
    if (socket) socket.disconnect();
    token = null;
    document.getElementById('controlScreen').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
}

function generateSeq() {
    return Date.now() + '_' + (++commandSeq);
}

function hasVelocityChanged(newLinear, newAngular) {
    const linearDiff = Math.abs(newLinear - lastSentVelocity.linear);
    const angularDiff = Math.abs(newAngular - lastSentVelocity.angular);
    return linearDiff > 0.01 || angularDiff > 0.01;
}

function sendVelocityCommand(linear, angular, force = false, fromPlayback = false) {
    if (!isControlling || !selectedRobotId) return;

    const now = Date.now();
    const timeSinceLastSend = now - lastVelocitySendTime;

    if (!force && timeSinceLastSend < MIN_SEND_INTERVAL) {
        return;
    }

    if (!force && !hasVelocityChanged(linear, angular)) {
        if (timeSinceLastSend < MAX_SEND_INTERVAL) {
            return;
        }
    }

    const seq = generateSeq();
    socket.emit('velocity_command', {
        robotId: selectedRobotId,
        linear: parseFloat(linear.toFixed(2)),
        angular: parseFloat(angular.toFixed(2)),
        seq: seq,
        timestamp: now
    });

    lastSentVelocity = { linear, angular };
    lastVelocitySendTime = now;
    
    if (isRecording && !fromPlayback) {
        trajectory.push({
            type: 'velocity',
            data: { linear: parseFloat(linear.toFixed(2)), angular: parseFloat(angular.toFixed(2)) },
            timestamp: now - recordingStartTime
        });
        updateTrajInfo();
    }
    
    addLog('velocity', `线速度: ${linear.toFixed(2)}, 角速度: ${angular.toFixed(2)} [seq:${seq.slice(-6)}]`);
}

function sendArmCommand(position, gripper, fromPlayback = false) {
    if (!isControlling || !selectedRobotId) return;

    const seq = generateSeq();
    socket.emit('arm_command', {
        robotId: selectedRobotId,
        position: position,
        gripper: gripper,
        seq: seq,
        timestamp: Date.now()
    });

    lastSentArm = { position: { ...position }, gripper };
    
    if (isRecording && !fromPlayback) {
        trajectory.push({
            type: 'arm',
            data: { position: { ...position }, gripper: gripper },
            timestamp: Date.now() - recordingStartTime
        });
        updateTrajInfo();
    }
    
    addLog('arm', `位置: (${position.x}, ${position.y}, ${position.z}), 夹爪: ${gripper ? '张开' : '闭合'} [seq:${seq.slice(-6)}]`);
}

function toggleRecording() {
    if (!isControlling) {
        alert('请先获取机器人控制权');
        return;
    }
    
    isRecording = !isRecording;
    const btn = document.getElementById('recordBtn');
    
    if (isRecording) {
        trajectory = [];
        recordingStartTime = Date.now();
        btn.textContent = '停止录制';
        btn.classList.add('recording');
        document.getElementById('trajStatus').textContent = '正在录制...';
        document.getElementById('playbackBtn').disabled = true;
        document.getElementById('clearTrajBtn').disabled = true;
    } else {
        btn.textContent = '开始录制';
        btn.classList.remove('recording');
        if (trajectory.length > 0) {
            document.getElementById('trajStatus').textContent = '录制完成';
            document.getElementById('playbackBtn').disabled = false;
            document.getElementById('clearTrajBtn').disabled = false;
        } else {
            document.getElementById('trajStatus').textContent = '未录制轨迹';
        }
    }
    updateTrajInfo();
}

function togglePlayback() {
    if (isPlaying) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    if (trajectory.length === 0) return;
    if (!isControlling) {
        alert('请先获取机器人控制权');
        return;
    }
    
    isPlaying = true;
    playbackIndex = 0;
    playbackStartTime = Date.now();
    
    const btn = document.getElementById('playbackBtn');
    btn.textContent = '停止回放';
    btn.classList.add('playing');
    document.getElementById('recordBtn').disabled = true;
    document.getElementById('trajStatus').textContent = '正在回放...';
    
    playbackNext();
}

function playbackNext() {
    if (!isPlaying || playbackIndex >= trajectory.length) {
        stopPlayback();
        return;
    }
    
    const item = trajectory[playbackIndex];
    const currentTime = Date.now() - playbackStartTime;
    const nextDelay = item.timestamp - currentTime;
    
    if (nextDelay > 0) {
        playbackTimer = setTimeout(() => {
            executePlaybackItem(item);
            playbackIndex++;
            playbackNext();
        }, nextDelay);
    } else {
        executePlaybackItem(item);
        playbackIndex++;
        playbackNext();
    }
}

function executePlaybackItem(item) {
    if (item.type === 'velocity') {
        sendVelocityCommand(item.data.linear, item.data.angular, true, true);
    } else if (item.type === 'arm') {
        sendArmCommand(item.data.position, item.data.gripper, true);
    }
}

function stopPlayback() {
    isPlaying = false;
    if (playbackTimer) {
        clearTimeout(playbackTimer);
        playbackTimer = null;
    }
    
    sendVelocityCommand(0, 0, true, true);
    
    const btn = document.getElementById('playbackBtn');
    btn.textContent = '开始回放';
    btn.classList.remove('playing');
    document.getElementById('recordBtn').disabled = false;
    document.getElementById('trajStatus').textContent = '回放完成';
}

function clearTrajectory() {
    trajectory = [];
    document.getElementById('playbackBtn').disabled = true;
    document.getElementById('clearTrajBtn').disabled = true;
    document.getElementById('trajStatus').textContent = '未录制轨迹';
    updateTrajInfo();
}

function updateTrajInfo() {
    document.getElementById('trajCount').textContent = trajectory.length;
    if (trajectory.length > 0) {
        const duration = (trajectory[trajectory.length - 1].timestamp / 1000).toFixed(1);
        document.getElementById('trajDuration').textContent = duration;
    } else {
        document.getElementById('trajDuration').textContent = '0';
    }
}

function initSocket() {
    socket = io({ 
        auth: { token },
        transports: ['websocket'],
        upgrade: false
    });

    socket.on('connect', () => {
        console.log('Connected to server');
        loadRobotList();
    });

    socket.on('robot_list_update', (robots) => {
        updateRobotList(robots);
    });

    socket.on('robot_pose', (data) => {
        updatePoseDisplay(data);
        update3DVisualization(data);
    });

    socket.on('control_response', (data) => {
        if (data.success) {
            isControlling = true;
            document.getElementById('controlStatus').textContent = `正在控制: ${data.robotId}`;
            document.getElementById('requestBtn').disabled = true;
            document.getElementById('releaseBtn').disabled = false;
            startWebRTC();
        } else {
            alert(data.error);
        }
    });

    socket.on('webrtc_offer', async (data) => {
        if (!peerConnection) initPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('webrtc_answer', {
            robotId: data.robotId,
            answer: answer
        });
    });

    socket.on('webrtc_answer', async (data) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    socket.on('webrtc_ice_candidate', async (data) => {
        if (peerConnection && data.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });

    socket.on('controller_disconnected', () => {
        isControlling = false;
        document.getElementById('controlStatus').textContent = '控制已断开';
        document.getElementById('requestBtn').disabled = false;
        document.getElementById('releaseBtn').disabled = true;
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
    });
}

function loadRobotList() {
    fetch('/api/robots')
        .then(res => res.json())
        .then(robots => updateRobotList(robots));
}

function updateRobotList(robots) {
    const container = document.getElementById('robotList');
    container.innerHTML = '';

    robots.forEach(robot => {
        const div = document.createElement('div');
        div.className = 'robot-item' + (robot.id === selectedRobotId ? ' selected' : '');
        div.innerHTML = `
            <span class="status"></span>${robot.name}
            <div class="controller">${robot.controller ? `控制中: ${robot.controller.userId}` : '空闲'}</div>
        `;
        div.onclick = () => selectRobot(robot.id);
        container.appendChild(div);
    });
}

function selectRobot(robotId) {
    selectedRobotId = robotId;
    loadRobotList();
    document.getElementById('controlStatus').textContent = `已选择: ${robotId}`;
}

function requestControl() {
    if (!selectedRobotId) {
        alert('请先选择一个机器人');
        return;
    }
    socket.emit('request_control', { robotId: selectedRobotId });
}

function releaseControl() {
    if (selectedRobotId) {
        socket.emit('release_control', { robotId: selectedRobotId });
        isControlling = false;
        document.getElementById('controlStatus').textContent = '控制已释放';
        document.getElementById('requestBtn').disabled = false;
        document.getElementById('releaseBtn').disabled = true;
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
    }
}

function initPeerConnection() {
    const config = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    };
    
    peerConnection = new RTCPeerConnection(config);

    peerConnection.ontrack = (event) => {
        document.getElementById('videoStream').srcObject = event.streams[0];
        document.getElementById('videoStatus').textContent = '视频已连接';
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc_ice_candidate', {
                robotId: selectedRobotId,
                candidate: event.candidate
            });
        }
    };

    peerConnection.onconnectionstatechange = () => {
        document.getElementById('videoStatus').textContent = `连接状态: ${peerConnection.connectionState}`;
    };
}

async function startWebRTC() {
    initPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('webrtc_offer', {
        robotId: selectedRobotId,
        offer: offer
    });
}

function initJoystick() {
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('joystickKnob');
    let isDragging = false;
    let sendInterval;

    const centerX = joystick.offsetWidth / 2;
    const centerY = joystick.offsetHeight / 2;
    const maxRadius = (joystick.offsetWidth - knob.offsetWidth) / 2;

    function updateKnob(clientX, clientY) {
        const rect = joystick.getBoundingClientRect();
        let x = clientX - rect.left - centerX;
        let y = clientY - rect.top - centerY;

        const distance = Math.sqrt(x * x + y * y);
        if (distance > maxRadius) {
            x = (x / distance) * maxRadius;
            y = (y / distance) * maxRadius;
        }

        knob.style.left = `${centerX + x}px`;
        knob.style.top = `${centerY + y}px`;

        const linear = -y / maxRadius;
        const angular = -x / maxRadius;
        
        document.getElementById('linearVel').textContent = linear.toFixed(2);
        document.getElementById('angularVel').textContent = angular.toFixed(2);

        return { linear, angular };
    }

    function resetKnob() {
        knob.style.left = '50%';
        knob.style.top = '50%';
        document.getElementById('linearVel').textContent = '0';
        document.getElementById('angularVel').textContent = '0';
    }

    function startDrag(e) {
        if (!isControlling) return;
        isDragging = true;
        const touch = e.touches ? e.touches[0] : e;
        const { linear, angular } = updateKnob(touch.clientX, touch.clientY);
        sendVelocityCommand(linear, angular, true);
        
        sendInterval = setInterval(() => {
            if (isDragging && isControlling && selectedRobotId) {
                const rect = joystick.getBoundingClientRect();
                const knobRect = knob.getBoundingClientRect();
                const x = (knobRect.left + knobRect.width/2) - rect.left - centerX;
                const y = (knobRect.top + knobRect.height/2) - rect.top - centerY;
                
                const linear = -y / maxRadius;
                const angular = -x / maxRadius;
                
                sendVelocityCommand(linear, angular);
            }
        }, MAX_SEND_INTERVAL);
    }

    function onMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        const { linear, angular } = updateKnob(touch.clientX, touch.clientY);
        sendVelocityCommand(linear, angular);
    }

    function endDrag() {
        isDragging = false;
        resetKnob();
        if (sendInterval) {
            clearInterval(sendInterval);
            sendInterval = null;
        }
        sendVelocityCommand(0, 0, true);
    }

    joystick.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', endDrag);
    
    joystick.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', endDrag);
}

function setGripper(state) {
    gripperState = state;
    document.getElementById('gripperOpen').classList.toggle('active', state);
    document.getElementById('gripperClose').classList.toggle('active', !state);
}

function sendArmCommand() {
    if (!isControlling || !selectedRobotId) {
        alert('请先获取机器人控制权');
        return;
    }

    const position = {
        x: parseFloat(document.getElementById('armX').value),
        y: parseFloat(document.getElementById('armY').value),
        z: parseFloat(document.getElementById('armZ').value)
    };

    sendArmCommand(position, gripperState);
}

function init3DVisualization() {
    const canvas = document.getElementById('vizCanvas');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(3, 3, 3);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    const gridHelper = new THREE.GridHelper(5, 20, 0x00d4ff, 0x333355);
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(1);
    scene.add(axesHelper);

    const bodyGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.4);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x00d4ff });
    robotMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    scene.add(robotMesh);

    const armColors = [0x0088aa, 0x00aacc, 0x00ccee, 0x00ddee, 0x44eeff, 0x66ffff];
    for (let i = 0; i < 6; i++) {
        const armGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16);
        const armMaterial = new THREE.MeshPhongMaterial({ color: armColors[i] });
        const arm = new THREE.Mesh(armGeometry, armMaterial);
        arm.position.y = 0.3 + i * 0.15;
        armMeshes.push(arm);
        scene.add(arm);
    }

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();
}

function update3DVisualization(data) {
    if (!robotMesh) return;

    const { pose, armAngles } = data;
    
    robotMesh.position.set(pose.x, 0.15, pose.y);
    
    robotMesh.rotation.set(
        pose.roll || 0,
        pose.yaw || 0,
        pose.pitch || 0,
        'YXZ'
    );

    armMeshes.forEach((arm, i) => {
        arm.rotation.z = armAngles[i] * Math.PI / 180;
    });
}

function updatePoseDisplay(data) {
    const { pose, armAngles } = data;
    document.getElementById('poseX').textContent = pose.x.toFixed(2);
    document.getElementById('poseY').textContent = pose.y.toFixed(2);
    document.getElementById('poseRoll').textContent = ((pose.roll || 0) * 180 / Math.PI).toFixed(1);
    document.getElementById('posePitch').textContent = ((pose.pitch || 0) * 180 / Math.PI).toFixed(1);
    document.getElementById('poseYaw').textContent = (pose.yaw * 180 / Math.PI).toFixed(1);
    document.getElementById('armAngles').textContent = armAngles.map(a => a.toFixed(1)).join(',');
}

function addLog(type, message) {
    const logContainer = document.getElementById('commandLog');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="time">[${time}]</span> <span class="type-${type}">[${type}]</span> ${message}`;
    
    logContainer.insertBefore(entry, logContainer.firstChild);
    
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

let keyboardState = { w: false, s: false, a: false, d: false };
let keyboardSendTimer = null;

function sendKeyboardVelocity() {
    let linear = 0, angular = 0;
    if (keyboardState.w) linear += 1;
    if (keyboardState.s) linear -= 1;
    if (keyboardState.a) angular += 1;
    if (keyboardState.d) angular -= 1;
    
    sendVelocityCommand(linear, angular);
}

document.addEventListener('keydown', (e) => {
    if (!isControlling || !selectedRobotId) return;
    if (e.repeat) return;

    const key = e.key.toLowerCase();
    if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        if (key === 'w' || key === 'arrowup') keyboardState.w = true;
        if (key === 's' || key === 'arrowdown') keyboardState.s = true;
        if (key === 'a' || key === 'arrowleft') keyboardState.a = true;
        if (key === 'd' || key === 'arrowright') keyboardState.d = true;
        
        sendKeyboardVelocity();
    }
});

document.addEventListener('keyup', (e) => {
    if (!isControlling || !selectedRobotId) return;

    const key = e.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') keyboardState.w = false;
    if (key === 's' || key === 'arrowdown') keyboardState.s = false;
    if (key === 'a' || key === 'arrowleft') keyboardState.a = false;
    if (key === 'd' || key === 'arrowright') keyboardState.d = false;
    
    sendKeyboardVelocity();
});

setGripper(true);
