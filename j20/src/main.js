import { VideoCapture } from './videoCapture.js';
import { ModelManager, STYLES } from './modelManager.js';
import { FaceMaskGenerator } from './faceMaskGenerator.js';
import { InferencePipeline } from './inferencePipeline.js';
import { StyleProcessor } from './styleProcessor.js';
import { PerformanceMonitor } from './performanceMonitor.js';
import { MaskClient } from './maskClient.js';

class NeuralStyleApp {
    constructor() {
        this.videoElement = document.getElementById('video');
        this.outputCanvas = document.getElementById('output-canvas');
        this.faceMaskCanvas = document.getElementById('face-mask-canvas');
        this.processingCanvas = document.getElementById('processing-canvas');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingText = document.getElementById('loading-text');
        this.styleGrid = document.getElementById('style-grid');
        this.statusDot = document.querySelector('.status-dot');
        this.statusText = document.getElementById('status-text');
        
        this.videoCapture = null;
        this.modelManager = new ModelManager();
        this.faceMaskGenerator = new FaceMaskGenerator(this.faceMaskCanvas);
        this.inferencePipeline = null;
        this.styleProcessor = new StyleProcessor(this.outputCanvas);
        this.performanceMonitor = new PerformanceMonitor();
        
        this.currentStyleId = null;
        this.isRunning = false;
        this.animationFrameId = null;
        this.intensity = 1.0;
        this.faceProtectionEnabled = true;
        
        this.frameIdCounter = 0;
        this.lastRenderedFrameId = -1;
        this.pendingInference = null;
        
        this.maskClient = new MaskClient();
        this.semanticMaskCanvas = null;
        this.textDescription = '';
        
        this.init();
    }

    async init() {
        this.setupStyleGrid();
        this.setupEventListeners();
        this.setupMaskClientCallbacks();
        this.updateStatus('正在初始化人脸检测...', 'loading');
        
        try {
            await this.faceMaskGenerator.init();
            this.updateStatus('准备就绪，请开启摄像头', 'ready');
        } catch (error) {
            console.error('Failed to initialize face detection:', error);
            this.updateStatus('人脸检测初始化失败，将禁用该功能', 'error');
            this.faceProtectionEnabled = false;
            document.getElementById('face-protection-toggle').checked = false;
        }
        
        this.hideLoading();
    }

    setupMaskClientCallbacks() {
        this.maskClient.onConnectionChange = (connected) => {
            this.updateConnectionStatus(connected);
        };
        
        this.maskClient.onMaskUpdate = (maskData) => {
            this.semanticMaskCanvas = maskData.maskCanvas;
            this.styleProcessor.setUseSemanticMask(maskData.maskCanvas !== null);
        };
    }

    setupStyleGrid() {
        STYLES.forEach((style, index) => {
            const card = document.createElement('div');
            card.className = 'style-card';
            card.dataset.styleId = style.id;
            card.innerHTML = `
                <img src="${style.preview}" alt="${style.name}">
                <div class="style-name">${style.name}</div>
            `;
            
            card.addEventListener('click', () => this.selectStyle(style.id));
            this.styleGrid.appendChild(card);
        });
    }

    setupEventListeners() {
        document.getElementById('camera-toggle').addEventListener('click', () => {
            this.toggleCamera();
        });

        document.getElementById('resolution-select').addEventListener('change', (e) => {
            const [width, height] = e.target.value.split('x').map(Number);
            this.changeResolution(width, height);
        });

        document.getElementById('intensity-slider').addEventListener('input', (e) => {
            this.intensity = e.target.value / 100;
            document.getElementById('intensity-value').textContent = `${e.target.value}%`;
            this.styleProcessor.setIntensity(this.intensity);
        });

        document.getElementById('face-protection-toggle').addEventListener('change', (e) => {
            this.faceProtectionEnabled = e.target.checked;
            this.faceMaskGenerator.setEnabled(this.faceProtectionEnabled);
            this.styleProcessor.setUseMask(this.faceProtectionEnabled);
            document.getElementById('face-blur-container').style.opacity = this.faceProtectionEnabled ? '1' : '0.5';
        });

        document.getElementById('face-blur-slider').addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('face-blur-value').textContent = `${value}px`;
            this.faceMaskGenerator.setBlurRadius(parseInt(value));
        });

        document.getElementById('show-perf-toggle').addEventListener('change', (e) => {
            this.performanceMonitor.setVisible(e.target.checked);
        });

        document.getElementById('connect-backend-btn').addEventListener('click', () => {
            this.connectToBackend();
        });

        document.getElementById('apply-text-btn').addEventListener('click', () => {
            this.applyTextDescription();
        });

        document.getElementById('clear-text-btn').addEventListener('click', () => {
            this.clearTextDescription();
        });

        document.getElementById('text-description').addEventListener('input', (e) => {
            this.textDescription = e.target.value;
            const btn = document.getElementById('apply-text-btn');
            btn.disabled = this.textDescription.trim().length === 0 || !this.maskClient.connected;
        });
    }

    async connectToBackend() {
        const url = document.getElementById('backend-url').value.trim();
        if (!url) return;

        const btn = document.getElementById('connect-backend-btn');
        btn.disabled = true;
        btn.textContent = '🔗 连接中...';

        try {
            await this.maskClient.connect(url);
            btn.textContent = '✅ 已连接';
            document.getElementById('apply-text-btn').disabled = this.textDescription.trim().length === 0;
        } catch (error) {
            console.error('Failed to connect:', error);
            btn.textContent = '🔗 连接后端';
            btn.disabled = false;
        }
    }

    async applyTextDescription() {
        const text = this.textDescription.trim();
        if (!text || !this.maskClient.connected) return;

        const btn = document.getElementById('apply-text-btn');
        btn.disabled = true;
        btn.textContent = '⏳ 处理中...';

        try {
            const { width, height } = this.videoCapture 
                ? this.videoCapture.getDimensions() 
                : { width: 640, height: 480 };
            
            const result = await this.maskClient.generateMask(text, width, height);
            
            if (result && result.maskCanvas) {
                this.semanticMaskCanvas = result.maskCanvas;
                this.styleProcessor.setUseSemanticMask(true);
                console.log('Mask generated with confidence:', result.confidence);
            }
            
            btn.textContent = '✨ 应用描述';
            btn.disabled = false;
        } catch (error) {
            console.error('Failed to apply text description:', error);
            btn.textContent = '❌ 失败';
            setTimeout(() => {
                btn.textContent = '✨ 应用描述';
                btn.disabled = false;
            }, 2000);
        }
    }

    clearTextDescription() {
        document.getElementById('text-description').value = '';
        this.textDescription = '';
        this.semanticMaskCanvas = null;
        this.styleProcessor.setUseSemanticMask(false);
        this.maskClient.clearMask();
        document.getElementById('apply-text-btn').disabled = true;
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('ws-status-dot');
        const statusText = document.getElementById('ws-status-text');
        const btn = document.getElementById('connect-backend-btn');
        
        if (connected) {
            statusDot.className = 'status-dot ready';
            statusText.textContent = '后端服务已连接';
            btn.textContent = '✅ 已连接';
            btn.disabled = true;
        } else {
            statusDot.className = 'status-dot error';
            statusText.textContent = '后端服务断开';
            btn.textContent = '🔗 重新连接';
            btn.disabled = false;
        }
    }

    async toggleCamera() {
        const button = document.getElementById('camera-toggle');
        
        if (this.videoCapture && this.videoCapture.isActive) {
            this.stopProcessing();
            button.textContent = '📹 开启摄像头';
            button.classList.remove('active');
        } else {
            button.disabled = true;
            button.textContent = '📹 正在开启...';
            
            try {
                await this.startCamera();
                button.textContent = '⏹️ 关闭摄像头';
                button.classList.add('active');
            } catch (error) {
                this.updateStatus(error.message, 'error');
                button.textContent = '📹 开启摄像头';
            } finally {
                button.disabled = false;
            }
        }
    }

    async startCamera() {
        const resolution = document.getElementById('resolution-select').value;
        const [width, height] = resolution.split('x').map(Number);
        
        this.videoCapture = new VideoCapture(this.videoElement, {
            width,
            height,
            frameRate: 30
        });
        
        this.showLoading('正在启动摄像头...');
        
        try {
            const dims = await this.videoCapture.start();
            this.performanceMonitor.setResolution(dims.width, dims.height);
            
            this.inferencePipeline = new InferencePipeline(
                this.modelManager,
                this.processingCanvas
            );
            this.inferencePipeline.setInputSize(dims.width, dims.height);
            
            if (!this.currentStyleId) {
                await this.selectStyle(STYLES[0].id);
            }
            
            this.hideLoading();
            this.startProcessing();
            this.updateStatus('处理中...', 'ready');
        } catch (error) {
            this.hideLoading();
            throw error;
        }
    }

    async selectStyle(styleId) {
        if (this.currentStyleId === styleId && this.modelManager.isLoaded(styleId)) {
            return;
        }
        
        const cards = document.querySelectorAll('.style-card');
        cards.forEach(card => card.classList.remove('active'));
        
        const selectedCard = document.querySelector(`[data-style-id="${styleId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('active');
        }
        
        if (!this.modelManager.isLoaded(styleId) && !this.modelManager.isLoading(styleId)) {
            if (selectedCard) {
                selectedCard.classList.add('loading');
            }
            this.updateStatus(`正在加载风格模型: ${STYLES.find(s => s.id === styleId)?.name}...`, 'loading');
            
            try {
                await this.modelManager.loadModel(styleId);
                this.currentStyleId = styleId;
                this.updateStatus('模型加载完成', 'ready');
            } catch (error) {
                console.error('Failed to load model:', error);
                this.updateStatus('模型加载失败，请检查网络连接', 'error');
            } finally {
                if (selectedCard) {
                    selectedCard.classList.remove('loading');
                }
            }
        } else {
            this.currentStyleId = styleId;
        }
    }

    startProcessing() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.processFrame();
    }

    stopProcessing() {
        this.isRunning = false;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        if (this.pendingInference) {
            this.pendingInference.cancel();
            this.pendingInference = null;
        }
        
        if (this.inferencePipeline) {
            this.inferencePipeline.cancelCurrentProcessing();
            this.inferencePipeline.dispose();
            this.inferencePipeline = null;
        }
        
        if (this.videoCapture) {
            this.videoCapture.stop();
            this.videoCapture = null;
        }
        
        this.frameIdCounter = 0;
        this.lastRenderedFrameId = -1;
    }

    async processFrame() {
        if (!this.isRunning) return;
        
        this.performanceMonitor.startFrame();
        
        try {
            const video = this.videoCapture.getCurrentFrame();
            if (!video) {
                this.animationFrameId = requestAnimationFrame(() => this.processFrame());
                return;
            }
            
            let inferenceTime = 0;
            const currentFrameId = ++this.frameIdCounter;
            
            if (this.modelManager.getCurrentModel()) {
                if (this.pendingInference) {
                    this.pendingInference.cancel();
                    this.inferencePipeline.cancelCurrentProcessing();
                }
                
                const inferencePromise = this.inferencePipeline.processFrame(video, currentFrameId);
                
                this.pendingInference = {
                    promise: inferencePromise,
                    frameId: currentFrameId,
                    cancelled: false,
                    cancel: function() {
                        this.cancelled = true;
                    }
                };
                
                const result = await inferencePromise;
                
                if (!this.pendingInference.cancelled && !result.isExpired && result.frameId > this.lastRenderedFrameId) {
                    inferenceTime = this.inferencePipeline.getTiming().inference;
                    
                    if (result.canvas) {
                        let maskCanvas = null;
                        
                        if (this.faceProtectionEnabled) {
                            const detections = await this.faceMaskGenerator.detectFaces(video);
                            maskCanvas = this.faceMaskGenerator.generateMask(video, detections);
                        }
                        
                        this.styleProcessor.process(video, result.canvas, maskCanvas, this.semanticMaskCanvas);
                        this.lastRenderedFrameId = result.frameId;
                    }
                }
            } else {
                const ctx = this.outputCanvas.getContext('2d');
                const { width, height } = this.videoCapture.getDimensions();
                this.outputCanvas.width = width;
                this.outputCanvas.height = height;
                ctx.drawImage(video, 0, 0, width, height);
                this.lastRenderedFrameId = currentFrameId;
            }
            
            this.pendingInference = null;
            this.performanceMonitor.endFrame(inferenceTime);
            
        } catch (error) {
            console.error('Frame processing error:', error);
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.processFrame());
    }

    async changeResolution(width, height) {
        if (!this.videoCapture || !this.videoCapture.isActive) return;
        
        this.showLoading('正在切换分辨率...');
        
        try {
            const dims = await this.videoCapture.setResolution(width, height);
            this.performanceMonitor.setResolution(dims.width, dims.height);
            this.inferencePipeline.setInputSize(dims.width, dims.height);
            this.hideLoading();
        } catch (error) {
            console.error('Resolution change failed:', error);
            this.hideLoading();
            this.updateStatus('分辨率切换失败', 'error');
        }
    }

    showLoading(text = '加载中...') {
        this.loadingText.textContent = text;
        this.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }

    updateStatus(text, state = 'loading') {
        this.statusText.textContent = text;
        this.statusDot.className = 'status-dot';
        
        if (state === 'ready') {
            this.statusDot.classList.add('ready');
        } else if (state === 'error') {
            this.statusDot.classList.add('error');
        }
    }

    destroy() {
        this.stopProcessing();
        this.faceMaskGenerator.release();
        this.modelManager.releaseAll();
        this.styleProcessor.dispose();
        if (this.maskClient) {
            this.maskClient.disconnect();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new NeuralStyleApp();
});

window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});
