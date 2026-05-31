export class FaceMaskGenerator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.faceDetection = null;
        this.isReady = false;
        this.lastDetections = [];
        this.enabled = true;
        this.blurRadius = 20;
        this.paddingRatio = 0.3;
        this.detectionFrameSkip = 2;
        this.frameCount = 0;
    }

    async init() {
        if (this.isReady) return;

        try {
            this.faceDetection = new FaceDetection({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
                }
            });

            this.faceDetection.setOptions({
                model: 'short',
                minDetectionConfidence: 0.5
            });

            this.faceDetection.onResults((results) => {
                this.lastDetections = results.detections || [];
            });

            this.isReady = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize FaceDetection:', error);
            return false;
        }
    }

    async detectFaces(videoElement) {
        if (!this.enabled || !this.isReady) return this.lastDetections;

        this.frameCount++;
        if (this.frameCount % this.detectionFrameSkip !== 0) {
            return this.lastDetections;
        }

        try {
            await this.faceDetection.send({ image: videoElement });
        } catch (error) {
        }

        return this.lastDetections;
    }

    generateMask(videoElement, detections) {
        const { videoWidth: width, videoHeight: height } = videoElement;
        
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        this.ctx.clearRect(0, 0, width, height);

        if (!this.enabled || !detections || detections.length === 0) {
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(0, 0, width, height);
            return this.canvas;
        }

        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.globalCompositeOperation = 'destination-out';

        for (const detection of detections) {
            const bbox = detection.boundingBox;
            const bboxW = bbox.width * width;
            const bboxH = bbox.height * height;
            const bboxX = bbox.xMin * width;
            const bboxY = bbox.yMin * height;

            const paddingX = bboxW * this.paddingRatio;
            const paddingY = bboxH * this.paddingRatio;

            const x = bboxX - paddingX;
            const y = bboxY - paddingY;
            const w = bboxW + paddingX * 2;
            const h = bboxH + paddingY * 2;

            this.drawFaceRegion(x, y, w, h);
        }

        this.ctx.globalCompositeOperation = 'source-over';

        if (this.blurRadius > 0) {
            this.applyBlur();
        }

        return this.canvas;
    }

    drawFaceRegion(x, y, w, h) {
        const gradient = this.ctx.createRadialGradient(
            x + w / 2, y + h / 2, Math.min(w, h) * 0.2,
            x + w / 2, y + h / 2, Math.max(w, h) * 0.7
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }

    applyBlur() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        const radius = this.blurRadius;
        const width = this.canvas.width;
        const height = this.canvas.height;

        const tempData = new Uint8ClampedArray(data);
        const kernelSize = radius * 2 + 1;
        const kernel = this.generateGaussianKernel(radius, radius / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0, weightSum = 0;

                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const px = Math.min(Math.max(x + kx, 0), width - 1);
                        const py = Math.min(Math.max(y + ky, 0), height - 1);
                        const idx = (py * width + px) * 4;
                        const weight = kernel[ky + radius][kx + radius];

                        r += tempData[idx] * weight;
                        g += tempData[idx + 1] * weight;
                        b += tempData[idx + 2] * weight;
                        a += tempData[idx + 3] * weight;
                        weightSum += weight;
                    }
                }

                const idx = (y * width + x) * 4;
                data[idx] = r / weightSum;
                data[idx + 1] = g / weightSum;
                data[idx + 2] = b / weightSum;
                data[idx + 3] = a / weightSum;
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    generateGaussianKernel(size, sigma) {
        const kernel = [];
        const twoSigmaSq = 2 * sigma * sigma;
        const piSigma = Math.sqrt(Math.PI * twoSigmaSq);

        for (let y = -size; y <= size; y++) {
            const row = [];
            for (let x = -size; x <= size; x++) {
                const exp = -(x * x + y * y) / twoSigmaSq;
                row.push(Math.exp(exp) / piSigma);
            }
            kernel.push(row);
        }

        return kernel;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.lastDetections = [];
        }
    }

    setBlurRadius(radius) {
        this.blurRadius = Math.max(0, Math.min(50, radius));
    }

    setDetectionFrameSkip(skip) {
        this.detectionFrameSkip = Math.max(1, skip);
    }

    getLastDetections() {
        return this.lastDetections;
    }

    release() {
        if (this.faceDetection) {
            this.faceDetection.close();
        }
        this.isReady = false;
        this.lastDetections = [];
    }
}
