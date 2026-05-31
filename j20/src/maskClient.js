export class MaskClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.maskData = null;
        this.confidence = 0;
        this.regions = {};
        this.maskCanvas = null;
        this.maskCtx = null;
        this.isLoading = false;
        this.onMaskUpdate = null;
        this.onConnectionChange = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.serverUrl = '';
    }

    async connect(url) {
        this.serverUrl = url;
        
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = url.startsWith('ws') ? url : `ws://${url}`;
                const fullUrl = `${wsUrl.replace(/\/$/, '')}/ws/mask`;
                
                this.ws = new WebSocket(fullUrl);
                
                this.ws.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    if (this.onConnectionChange) {
                        this.onConnectionChange(true);
                    }
                    resolve(true);
                };
                
                this.ws.onclose = () => {
                    this.connected = false;
                    if (this.onConnectionChange) {
                        this.onConnectionChange(false);
                    }
                    this._attemptReconnect();
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };
                
                this.ws.onmessage = (event) => {
                    this._handleMessage(JSON.parse(event.data));
                };
                
            } catch (error) {
                console.error('Connection failed:', error);
                reject(error);
            }
        });
    }

    _attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnect attempts reached');
            return;
        }
        
        if (!this.serverUrl) return;
        
        this.reconnectAttempts++;
        setTimeout(() => {
            console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
            this.connect(this.serverUrl).catch(() => {});
        }, this.reconnectDelay);
    }

    _handleMessage(message) {
        switch (message.type) {
            case 'mask_data':
                this._processMaskData(message);
                break;
            case 'error':
                console.error('Server error:', message.message);
                this.isLoading = false;
                break;
        }
    }

    _processMaskData(message) {
        try {
            this.maskData = message.mask;
            this.confidence = message.confidence || 0;
            this.regions = message.regions || {};
            
            if (this.maskData) {
                this._decodeMaskFromBase64(this.maskData);
            }
            
            this.isLoading = false;
            
            if (this.onMaskUpdate) {
                this.onMaskUpdate({
                    maskCanvas: this.maskCanvas,
                    confidence: this.confidence,
                    regions: this.regions
                });
            }
        } catch (error) {
            console.error('Failed to process mask data:', error);
            this.isLoading = false;
        }
    }

    _decodeMaskFromBase64(base64Data) {
        try {
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const view = new DataView(bytes.buffer);
            const width = view.getUint32(0, false);
            const height = view.getUint32(4, false);
            
            const maskData = new Uint8ClampedArray(bytes.buffer, 8, width * height);
            
            if (!this.maskCanvas) {
                this.maskCanvas = document.createElement('canvas');
                this.maskCtx = this.maskCanvas.getContext('2d');
            }
            
            this.maskCanvas.width = width;
            this.maskCanvas.height = height;
            
            const imageData = this.maskCtx.createImageData(width, height);
            for (let i = 0; i < maskData.length; i++) {
                const pixelIdx = i * 4;
                imageData.data[pixelIdx] = maskData[i];
                imageData.data[pixelIdx + 1] = maskData[i];
                imageData.data[pixelIdx + 2] = maskData[i];
                imageData.data[pixelIdx + 3] = 255;
            }
            
            this.maskCtx.putImageData(imageData, 0, 0);
            
        } catch (error) {
            console.error('Failed to decode mask:', error);
        }
    }

    async generateMask(text, width = 640, height = 480) {
        if (!this.connected) {
            console.warn('Not connected to server');
            return null;
        }
        
        this.isLoading = true;
        
        try {
            const message = {
                type: 'generate_mask',
                text: text,
                width: width,
                height: height
            };
            
            this.ws.send(JSON.stringify(message));
            
            return new Promise((resolve) => {
                const checkMask = () => {
                    if (!this.isLoading) {
                        resolve({
                            maskCanvas: this.maskCanvas,
                            confidence: this.confidence,
                            regions: this.regions
                        });
                    } else {
                        setTimeout(checkMask, 100);
                    }
                };
                setTimeout(checkMask, 100);
            });
            
        } catch (error) {
            console.error('Failed to generate mask:', error);
            this.isLoading = false;
            return null;
        }
    }

    async generateMaskRest(text, width = 640, height = 480) {
        try {
            const httpUrl = this.serverUrl
                .replace('ws://', 'http://')
                .replace('wss://', 'https://');
            
            const response = await fetch(`${httpUrl}/api/generate-mask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    image_width: width,
                    image_height: height
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            this._processMaskData(result);
            
            return {
                maskCanvas: this.maskCanvas,
                confidence: this.confidence,
                regions: this.regions
            };
            
        } catch (error) {
            console.error('REST API error:', error);
            return null;
        }
    }

    clearMask() {
        this.maskData = null;
        this.confidence = 0;
        this.regions = {};
        this.maskCanvas = null;
        
        if (this.onMaskUpdate) {
            this.onMaskUpdate({
                maskCanvas: null,
                confidence: 0,
                regions: {}
            });
        }
    }

    getMaskCanvas() {
        return this.maskCanvas;
    }

    hasMask() {
        return this.maskCanvas !== null;
    }

    disconnect() {
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.maskData = null;
        this.maskCanvas = null;
    }
}
