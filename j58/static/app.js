const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const modelStatus = document.getElementById('modelStatus');
const wsStatus = document.getElementById('wsStatus');
const recognizedText = document.getElementById('recognizedText');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const audioPlayer = document.getElementById('audioPlayer');

const trainVideoElement = document.getElementById('trainVideo');
const trainCanvasElement = document.getElementById('trainCanvas');
const trainCanvasCtx = trainCanvasElement.getContext('2d');
const gestureIdInput = document.getElementById('gestureId');
const gestureNameInput = document.getElementById('gestureName');
const startTrainBtn = document.getElementById('startTrainBtn');
const recordSampleBtn = document.getElementById('recordSampleBtn');
const trainModelBtn = document.getElementById('trainModelBtn');
const clearSamplesBtn = document.getElementById('clearSamplesBtn');
const refreshGesturesBtn = document.getElementById('refreshGesturesBtn');
const recordingStatus = document.getElementById('recordingStatus');
const recordingText = document.getElementById('recordingText');
const progressFill = document.getElementById('progressFill');
const trainedGesturesList = document.getElementById('trainedGesturesList');
const trainMessage = document.getElementById('trainMessage');

let hands = null;
let trainHands = null;
let camera = null;
let trainCamera = null;
let ws = null;
let isRunning = false;
let isTrainingMode = false;
let lastSendTime = 0;
const SEND_INTERVAL = 100;
let audioRequestId = 0;
let pendingAudioRequests = new Map();

let collectedSamples = [];
let isRecordingSample = false;
let sampleCount = 0;
const REQUIRED_SAMPLES = 5;
let currentLandmarks = null;

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        if (tabId === 'train') {
            isTrainingMode = true;
            if (isRunning) {
                stopRecognition();
            }
            initTrainingMode();
        } else {
            isTrainingMode = false;
            stopTrainingMode();
        }
    });
});

async function checkCameraPermissions() {
    try {
        const result = await navigator.permissions.query({ name: 'camera' });
        return result.state === 'granted';
    } catch (e) {
        return false;
    }
}

async function requestCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false
        });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (e) {
        console.error('摄像头权限请求失败:', e);
        recognizedText.textContent = '摄像头权限被拒绝，请在浏览器设置中允许摄像头访问';
        return false;
    }
}

function initHands() {
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);
    modelStatus.classList.add('active');
}

function initTrainHands() {
    trainHands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    trainHands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });

    trainHands.onResults(onTrainResults);
}

function initWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        wsStatus.classList.add('active');
    };
    
    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.text) {
            recognizedText.textContent = `识别结果: ${data.text}`;
        }
        if (data.audio_ready && data.request_id) {
            playAudio(data.request_id);
        }
    };
    
    ws.onclose = () => {
        wsStatus.classList.remove('active');
        setTimeout(initWebSocket, 3000);
    };
    
    ws.onerror = () => {
        wsStatus.classList.remove('active');
    };
}

async function playAudio(requestId) {
    try {
        const response = await fetch(`/audio-stream?request_id=${requestId}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            audioPlayer.src = url;
            await audioPlayer.play();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
    } catch (error) {
        console.error('播放音频失败:', error);
    }
}

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
            drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 3});
            
            const now = Date.now();
            if (now - lastSendTime > SEND_INTERVAL && ws && ws.readyState === WebSocket.OPEN) {
                lastSendTime = now;
                const landmarkData = landmarks.map(lm => ({
                    x: lm.x,
                    y: lm.y,
                    z: lm.z
                }));
                ws.send(JSON.stringify({ 
                    landmarks: landmarkData,
                    request_id: ++audioRequestId
                }));
            }
        }
    }
    canvasCtx.restore();
}

function onTrainResults(results) {
    trainCanvasCtx.save();
    trainCanvasCtx.clearRect(0, 0, trainCanvasElement.width, trainCanvasElement.height);
    trainCanvasCtx.drawImage(results.image, 0, 0, trainCanvasElement.width, trainCanvasElement.height);

    currentLandmarks = null;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        drawConnectors(trainCanvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        drawLandmarks(trainCanvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 3});
        
        currentLandmarks = landmarks.map(lm => ({
            x: lm.x,
            y: lm.y,
            z: lm.z
        }));
    }
    trainCanvasCtx.restore();
}

async function startCamera() {
    try {
        camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({image: videoElement});
            },
            width: 640,
            height: 480
        });
        await camera.start();
        recognizedText.textContent = '摄像头已启动，请展示手势';
    } catch (e) {
        console.error('启动摄像头失败:', e);
        recognizedText.textContent = '摄像头启动失败，请刷新页面重试';
        isRunning = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

async function startTrainCamera() {
    try {
        trainCamera = new Camera(trainVideoElement, {
            onFrame: async () => {
                await trainHands.send({image: trainVideoElement});
            },
            width: 640,
            height: 480
        });
        await trainCamera.start();
        showTrainMessage('摄像头已启动，请将手放在摄像头前', 'info');
    } catch (e) {
        console.error('启动训练摄像头失败:', e);
        showTrainMessage('摄像头启动失败，请刷新页面重试', 'error');
    }
}

function initTrainingMode() {
    if (!trainHands) {
        initTrainHands();
    }
    trainCanvasElement.width = 640;
    trainCanvasElement.height = 480;
    loadTrainedGestures();
}

function stopTrainingMode() {
    if (trainCamera) {
        trainCamera.stop();
        trainCamera = null;
    }
    if (trainVideoElement.srcObject) {
        trainVideoElement.srcObject.getTracks().forEach(track => track.stop());
        trainVideoElement.srcObject = null;
    }
}

function stopRecognition() {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    if (camera) {
        camera.stop();
        camera = null;
    }
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    recognizedText.textContent = '识别已停止';
}

startBtn.addEventListener('click', async () => {
    if (!isRunning) {
        startBtn.disabled = true;
        recognizedText.textContent = '正在请求摄像头权限...';
        
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            startBtn.disabled = false;
            return;
        }
        
        isRunning = true;
        stopBtn.disabled = false;
        
        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;
        
        if (!hands) {
            initHands();
        }
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            initWebSocket();
        }
        
        await startCamera();
    }
});

stopBtn.addEventListener('click', stopRecognition);

startTrainBtn.addEventListener('click', async () => {
    const gestureId = gestureIdInput.value.trim();
    const gestureName = gestureNameInput.value.trim();
    
    if (!gestureId || !gestureName) {
        showTrainMessage('请填写手势 ID 和手势名称', 'error');
        return;
    }
    
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
        showTrainMessage('摄像头权限被拒绝', 'error');
        return;
    }
    
    collectedSamples = [];
    sampleCount = 0;
    updateProgress();
    
    startTrainBtn.disabled = true;
    gestureIdInput.disabled = true;
    gestureNameInput.disabled = true;
    recordSampleBtn.disabled = false;
    clearSamplesBtn.disabled = false;
    
    recordingStatus.classList.add('active');
    recordingText.textContent = `请展示手势"${gestureName}"，然后点击"录制样本"`;
    
    trainCanvasElement.width = trainVideoElement.videoWidth || 640;
    trainCanvasElement.height = trainVideoElement.videoHeight || 480;
    
    await startTrainCamera();
    showTrainMessage('摄像头已启动，准备录制样本', 'info');
});

recordSampleBtn.addEventListener('click', () => {
    if (!currentLandmarks) {
        showTrainMessage('未检测到手部关键点，请将手放在摄像头前', 'error');
        return;
    }
    
    collectedSamples.push([...currentLandmarks]);
    sampleCount++;
    updateProgress();
    
    recordingStatus.classList.add('recording');
    recordingText.textContent = `已录制 ${sampleCount}/${REQUIRED_SAMPLES} 个样本`;
    
    setTimeout(() => {
        recordingStatus.classList.remove('recording');
        if (sampleCount < REQUIRED_SAMPLES) {
            recordingText.textContent = `请稍微调整手势，继续录制 (${sampleCount}/${REQUIRED_SAMPLES})`;
        } else {
            recordingText.textContent = `已录制足够样本，可以训练模型了！`;
            trainModelBtn.disabled = false;
            recordSampleBtn.disabled = true;
        }
    }, 500);
});

clearSamplesBtn.addEventListener('click', () => {
    collectedSamples = [];
    sampleCount = 0;
    updateProgress();
    recordSampleBtn.disabled = false;
    trainModelBtn.disabled = true;
    recordingText.textContent = '样本已清除，请重新录制';
    showTrainMessage('样本已清除', 'info');
});

trainModelBtn.addEventListener('click', async () => {
    const gestureId = gestureIdInput.value.trim();
    const gestureName = gestureNameInput.value.trim();
    
    if (collectedSamples.length < 3) {
        showTrainMessage('至少需要 3 个样本才能训练', 'error');
        return;
    }
    
    trainModelBtn.disabled = true;
    recordSampleBtn.disabled = true;
    recordingText.textContent = '正在训练模型...';
    
    try {
        const response = await fetch('/api/train-gesture', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gesture_id: gestureId,
                gesture_name: gestureName,
                samples: collectedSamples
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showTrainMessage(result.message, 'success');
            recordingText.textContent = '训练完成！手势已添加到模型中';
            
            setTimeout(() => {
                resetTrainingForm();
                loadTrainedGestures();
            }, 2000);
        } else {
            showTrainMessage(result.detail || '训练失败', 'error');
            trainModelBtn.disabled = false;
        }
    } catch (e) {
        console.error('训练失败:', e);
        showTrainMessage('网络错误，请重试', 'error');
        trainModelBtn.disabled = false;
    }
});

refreshGesturesBtn.addEventListener('click', loadTrainedGestures);

async function loadTrainedGestures() {
    try {
        const response = await fetch('/api/gestures');
        const result = await response.json();
        
        if (result.success && result.gestures.length > 0) {
            let html = '';
            for (const gesture of result.gestures) {
                html += `
                    <div class="trained-gesture-item">
                        <div class="gesture-info">
                            <div class="gesture-name">${gesture.name}</div>
                            <div class="gesture-id">ID: ${gesture.id}</div>
                        </div>
                        <div class="gesture-samples">${gesture.samples} 个样本</div>
                        <button class="btn-danger delete-btn" data-id="${gesture.id}">删除</button>
                    </div>
                `;
            }
            trainedGesturesList.innerHTML = html;
            
            trainedGesturesList.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const gestureId = btn.dataset.id;
                    if (confirm(`确定要删除手势 "${gestureId}" 吗？`)) {
                        await deleteGesture(gestureId);
                    }
                });
            });
        } else {
            trainedGesturesList.innerHTML = `
                <div style="color: #666; text-align: center; padding: 20px;">
                    暂无已训练手势
                </div>
            `;
        }
    } catch (e) {
        console.error('加载手势列表失败:', e);
    }
}

async function deleteGesture(gestureId) {
    try {
        const response = await fetch(`/api/gestures/${gestureId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        
        if (result.success) {
            showTrainMessage(result.message, 'success');
            loadTrainedGestures();
        } else {
            showTrainMessage(result.detail || '删除失败', 'error');
        }
    } catch (e) {
        console.error('删除失败:', e);
        showTrainMessage('网络错误，请重试', 'error');
    }
}

function updateProgress() {
    const progress = (sampleCount / REQUIRED_SAMPLES) * 100;
    progressFill.style.width = `${progress}%`;
}

function showTrainMessage(message, type) {
    trainMessage.textContent = message;
    trainMessage.className = `message ${type}`;
    
    if (type !== 'error') {
        setTimeout(() => {
            trainMessage.className = 'message';
        }, 3000);
    }
}

function resetTrainingForm() {
    gestureIdInput.value = '';
    gestureNameInput.value = '';
    gestureIdInput.disabled = false;
    gestureNameInput.disabled = false;
    startTrainBtn.disabled = false;
    recordSampleBtn.disabled = true;
    trainModelBtn.disabled = true;
    clearSamplesBtn.disabled = true;
    recordingStatus.classList.remove('active');
    recordingStatus.classList.remove('recording');
    collectedSamples = [];
    sampleCount = 0;
    updateProgress();
    
    if (trainCamera) {
        trainCamera.stop();
        trainCamera = null;
    }
    if (trainVideoElement.srcObject) {
        trainVideoElement.srcObject.getTracks().forEach(track => track.stop());
        trainVideoElement.srcObject = null;
    }
}

window.addEventListener('load', () => {
    canvasElement.width = 640;
    canvasElement.height = 480;
    
    checkCameraPermissions().then(hasPermission => {
        if (!hasPermission) {
            recognizedText.textContent = '点击"开始识别"按钮请求摄像头权限';
        }
    });
});
