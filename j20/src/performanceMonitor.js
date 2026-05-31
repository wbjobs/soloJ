export class PerformanceMonitor {
    constructor(options = {}) {
        this.fpsElement = document.getElementById('fps-value');
        this.inferenceTimeElement = document.getElementById('inference-time');
        this.totalTimeElement = document.getElementById('total-time');
        this.resolutionElement = document.getElementById('resolution');
        this.panelElement = document.getElementById('performance-panel');

        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.currentFps = 0;

        this.inferenceTimes = [];
        this.totalTimes = [];
        this.maxSamples = options.maxSamples || 30;

        this.resolution = { width: 0, height: 0 };
        this.visible = true;
    }

    startFrame() {
        this.frameStartTime = performance.now();
    }

    endFrame(inferenceTime = 0) {
        const totalTime = performance.now() - this.frameStartTime;
        
        this.addInferenceTime(inferenceTime);
        this.addTotalTime(totalTime);
        this.updateFps();
        this.updateDisplay();
    }

    updateFps() {
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastFpsUpdate >= 1000) {
            this.currentFps = Math.round(
                (this.frameCount * 1000) / (now - this.lastFpsUpdate)
            );
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
    }

    addInferenceTime(time) {
        this.inferenceTimes.push(time);
        if (this.inferenceTimes.length > this.maxSamples) {
            this.inferenceTimes.shift();
        }
    }

    addTotalTime(time) {
        this.totalTimes.push(time);
        if (this.totalTimes.length > this.maxSamples) {
            this.totalTimes.shift();
        }
    }

    getAverageInferenceTime() {
        if (this.inferenceTimes.length === 0) return 0;
        const sum = this.inferenceTimes.reduce((a, b) => a + b, 0);
        return sum / this.inferenceTimes.length;
    }

    getAverageTotalTime() {
        if (this.totalTimes.length === 0) return 0;
        const sum = this.totalTimes.reduce((a, b) => a + b, 0);
        return sum / this.totalTimes.length;
    }

    setResolution(width, height) {
        this.resolution = { width, height };
    }

    updateDisplay() {
        if (this.fpsElement) {
            this.fpsElement.textContent = this.currentFps;
        }
        
        if (this.inferenceTimeElement) {
            this.inferenceTimeElement.textContent = 
                `${this.getAverageInferenceTime().toFixed(1)}ms`;
        }
        
        if (this.totalTimeElement) {
            this.totalTimeElement.textContent = 
                `${this.getAverageTotalTime().toFixed(1)}ms`;
        }
        
        if (this.resolutionElement && this.resolution.width > 0) {
            this.resolutionElement.textContent = 
                `${this.resolution.width}x${this.resolution.height}`;
        }
    }

    setVisible(visible) {
        this.visible = visible;
        if (this.panelElement) {
            this.panelElement.classList.toggle('hidden', !visible);
        }
    }

    reset() {
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.currentFps = 0;
        this.inferenceTimes = [];
        this.totalTimes = [];
    }

    getStats() {
        return {
            fps: this.currentFps,
            avgInferenceTime: this.getAverageInferenceTime(),
            avgTotalTime: this.getAverageTotalTime(),
            resolution: this.resolution
        };
    }

    static measure(fn, label = 'execution') {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        return { result, time: end - start };
    }

    static async measureAsync(fn, label = 'async execution') {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        return { result, time: end - start };
    }
}
