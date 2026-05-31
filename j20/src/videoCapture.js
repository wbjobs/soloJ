export class VideoCapture {
    constructor(videoElement, options = {}) {
        this.video = videoElement;
        this.stream = null;
        this.isActive = false;
        this.options = {
            width: options.width || 1280,
            height: options.height || 720,
            frameRate: options.frameRate || 30,
            facingMode: options.facingMode || 'user'
        };
    }

    async start() {
        if (this.isActive) return;

        try {
            const constraints = {
                video: {
                    width: { ideal: this.options.width },
                    height: { ideal: this.options.height },
                    frameRate: { ideal: this.options.frameRate },
                    facingMode: this.options.facingMode
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });

            this.isActive = true;
            return {
                width: this.video.videoWidth,
                height: this.video.videoHeight
            };
        } catch (error) {
            console.error('Failed to start video capture:', error);
            throw new Error('无法访问摄像头，请确保已授予权限');
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.video.srcObject = null;
        this.isActive = false;
    }

    getCurrentFrame() {
        if (!this.isActive) return null;
        return this.video;
    }

    getDimensions() {
        if (!this.isActive) return { width: 0, height: 0 };
        return {
            width: this.video.videoWidth,
            height: this.video.videoHeight
        };
    }

    async setResolution(width, height) {
        const wasActive = this.isActive;
        if (wasActive) {
            this.stop();
        }
        
        this.options.width = width;
        this.options.height = height;
        
        if (wasActive) {
            return await this.start();
        }
    }

    static async getAvailableResolutions() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            
            const resolutions = [
                { width: 640, height: 480, label: '480p' },
                { width: 1280, height: 720, label: '720p' },
                { width: 1920, height: 1080, label: '1080p' }
            ];
            
            return resolutions;
        } catch (error) {
            console.error('Failed to get resolutions:', error);
            return [];
        }
    }
}
