export class InferencePipeline {
    constructor(modelManager, processingCanvas) {
        this.modelManager = modelManager;
        this.processingCanvas = processingCanvas;
        this.processingCtx = processingCanvas.getContext('2d');
        
        this.inputSize = { width: 480, height: 640 };
        this.outputSize = { width: 480, height: 640 };
        
        this.frameCounter = 0;
        this.processingFrameId = -1;
        this.lastValidFrameId = -1;
        
        this.outputCanvasA = document.createElement('canvas');
        this.outputCanvasB = document.createElement('canvas');
        this.outputCtxA = this.outputCanvasA.getContext('2d');
        this.outputCtxB = this.outputCanvasB.getContext('2d');
        this.currentOutputCanvas = this.outputCanvasA;
        
        this.pendingResult = null;
        
        this.preprocessingTime = 0;
        this.inferenceTime = 0;
        this.postprocessingTime = 0;
        
        this.isProcessing = false;
        this.isCancelled = false;
    }

    setInputSize(width, height) {
        const maxDim = Math.max(width, height);
        const scale = 480 / maxDim;
        
        this.inputSize.width = Math.round(width * scale);
        this.inputSize.height = Math.round(height * scale);
        
        this.inputSize.width = Math.floor(this.inputSize.width / 4) * 4;
        this.inputSize.height = Math.floor(this.inputSize.height / 4) * 4;
        
        this.outputSize = { ...this.inputSize };
        
        this.processingCanvas.width = this.inputSize.width;
        this.processingCanvas.height = this.inputSize.height;
        this.outputCanvasA.width = this.outputSize.width;
        this.outputCanvasA.height = this.outputSize.height;
        this.outputCanvasB.width = this.outputSize.width;
        this.outputCanvasB.height = this.outputSize.height;
    }

    getNextFrameId() {
        return ++this.frameCounter;
    }

    cancelCurrentProcessing() {
        this.isCancelled = true;
    }

    async processFrame(videoElement, frameId) {
        if (this.isProcessing || !this.modelManager.getCurrentModel()) {
            return { canvas: null, frameId: -1, isExpired: true };
        }
        
        this.isProcessing = true;
        this.isCancelled = false;
        this.processingFrameId = frameId;
        
        try {
            const preprocessStart = performance.now();
            this.preprocess(videoElement);
            this.preprocessingTime = performance.now() - preprocessStart;
            
            if (this.isCancelled) {
                return { canvas: null, frameId, isExpired: true };
            }
            
            const inferenceStart = performance.now();
            const outputData = await this.runInference();
            this.inferenceTime = performance.now() - inferenceStart;
            
            if (this.isCancelled) {
                return { canvas: null, frameId, isExpired: true };
            }
            
            const postprocessStart = performance.now();
            this.postprocess(outputData);
            this.postprocessingTime = performance.now() - postprocessStart;
            
            this.lastValidFrameId = frameId;
            
            return { 
                canvas: this.currentOutputCanvas, 
                frameId, 
                isExpired: false 
            };
        } finally {
            this.isProcessing = false;
        }
    }

    preprocess(videoElement) {
        const { width, height } = this.inputSize;
        
        this.processingCtx.drawImage(videoElement, 0, 0, width, height);
        
        const imageData = this.processingCtx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const inputData = new Float32Array(3 * width * height);
        
        for (let i = 0; i < width * height; i++) {
            const pixelIndex = i * 4;
            const channelIndex = i;
            
            inputData[channelIndex] = (data[pixelIndex] / 255.0 - 0.485) / 0.229;
            inputData[channelIndex + width * height] = (data[pixelIndex + 1] / 255.0 - 0.456) / 0.224;
            inputData[channelIndex + 2 * width * height] = (data[pixelIndex + 2] / 255.0 - 0.406) / 0.225;
        }
        
        this.inputTensor = new ort.Tensor('float32', inputData, [1, 3, height, width]);
    }

    async runInference() {
        const model = this.modelManager.getCurrentModel();
        if (!model || !this.inputTensor) {
            throw new Error('Model or input tensor not available');
        }
        
        const inputs = {};
        const inputNames = model.inputNames;
        inputs[inputNames[0]] = this.inputTensor;
        
        const outputs = await model.run(inputs);
        
        const outputNames = model.outputNames;
        return outputs[outputNames[0]];
    }

    postprocess(outputTensor) {
        const { width, height } = this.outputSize;
        const data = outputTensor.data;
        
        const nextOutputCanvas = (this.currentOutputCanvas === this.outputCanvasA) 
            ? this.outputCanvasB 
            : this.outputCanvasA;
        const nextOutputCtx = (this.currentOutputCanvas === this.outputCanvasA) 
            ? this.outputCtxB 
            : this.outputCtxA;
        
        const imageData = nextOutputCtx.createImageData(width, height);
        const pixels = imageData.data;
        
        const chwToHwc = (c, h, w) => c * height * width + h * width + w;
        
        for (let h = 0; h < height; h++) {
            for (let w = 0; w < width; w++) {
                const pixelIdx = (h * width + w) * 4;
                
                let r = data[chwToHwc(0, h, w)];
                let g = data[chwToHwc(1, h, w)];
                let b = data[chwToHwc(2, h, w)];
                
                r = r * 0.229 + 0.485;
                g = g * 0.224 + 0.456;
                b = b * 0.225 + 0.406;
                
                r = Math.min(255, Math.max(0, r * 255));
                g = Math.min(255, Math.max(0, g * 255));
                b = Math.min(255, Math.max(0, b * 255));
                
                pixels[pixelIdx] = r;
                pixels[pixelIdx + 1] = g;
                pixels[pixelIdx + 2] = b;
                pixels[pixelIdx + 3] = 255;
            }
        }
        
        nextOutputCtx.putImageData(imageData, 0, 0);
        this.currentOutputCanvas = nextOutputCanvas;
    }

    getTiming() {
        return {
            preprocessing: this.preprocessingTime,
            inference: this.inferenceTime,
            postprocessing: this.postprocessingTime,
            total: this.preprocessingTime + this.inferenceTime + this.postprocessingTime
        };
    }

    getOutputCanvas() {
        return this.outputCanvas;
    }

    dispose() {
        this.inputTensor = null;
        this.inputData = null;
    }
}
