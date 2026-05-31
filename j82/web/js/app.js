import initModule, { AudioProcessor } from '../pkg/audio_processor.js';

class AudioSpectrumApp {
    constructor() {
        this.wasmModule = null;
        this.audioProcessor = null;
        this.audioContext = null;
        this.audioBuffer = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.analyser = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.animationId = null;
        this.spectrogramData = null;
        this.spectrogramIndex = 0;
        
        this.fftSize = 2048;
        this.visualMode = 'bars';
        this.colorScheme = 'rainbow';
        this.logScale = true;
        this.smooth = true;
        this.smoothedMagnitudes = [];
        this.currentMagnitudes = [];
        this.currentFrequencies = [];
        this.currentFilteredMagnitudes = [];
        this.canvasDpr = 1;
        
        this.filterEnabled = false;
        this.cutoffFreq = 2000;
        this.smoothedFilteredMagnitudes = [];
        
        this.initElements();
        this.initEventListeners();
        this.initWasm();
    }

    initElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileName = document.getElementById('fileName');
        this.fileSize = document.getElementById('fileSize');
        this.btnRemove = document.getElementById('btnRemove');
        
        this.fftSizeSelect = document.getElementById('fftSize');
        this.visualModeSelect = document.getElementById('visualMode');
        this.colorSchemeSelect = document.getElementById('colorScheme');
        this.logScaleCheckbox = document.getElementById('logScale');
        this.smoothCheckbox = document.getElementById('smooth');
        
        this.playerSection = document.getElementById('playerSection');
        this.btnPlay = document.getElementById('btnPlay');
        this.btnPause = document.getElementById('btnPause');
        this.btnStop = document.getElementById('btnStop');
        this.progressFill = document.getElementById('progressFill');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.progressBar = document.querySelector('.progress-bar');
        
        this.spectrumCanvas = document.getElementById('spectrumCanvas');
        this.spectrogramCanvas = document.getElementById('spectrogramCanvas');
        this.spectrumCtx = this.spectrumCanvas.getContext('2d');
        this.spectrogramCtx = this.spectrogramCanvas.getContext('2d');
        
        this.statSampleRate = document.getElementById('statSampleRate');
        this.statChannels = document.getElementById('statChannels');
        this.statFftSize = document.getElementById('statFftSize');
        this.statPeakFreq = document.getElementById('statPeakFreq');
        this.statProcessTime = document.getElementById('statProcessTime');
        
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorText = document.getElementById('errorText');
        this.btnCloseError = document.getElementById('btnCloseError');
        
        this.freqLabels = [];
        for (let i = 0; i < 7; i++) {
            this.freqLabels.push(document.getElementById('freqLabel' + i));
        }
        
        this.filterSection = document.getElementById('filterSection');
        this.filterEnabledCheckbox = document.getElementById('filterEnabled');
        this.filterStatus = document.getElementById('filterStatus');
        this.filterControls = document.getElementById('filterControls');
        this.cutoffSlider = document.getElementById('cutoffSlider');
        this.cutoffValue = document.getElementById('cutoffValue');
        this.spectrumLegend = document.getElementById('spectrumLegend');
    }

    initEventListeners() {
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.btnRemove.addEventListener('click', () => this.removeFile());
        
        this.fftSizeSelect.addEventListener('change', () => {
            this.fftSize = parseInt(this.fftSizeSelect.value);
            this.recreateProcessor();
        });
        this.visualModeSelect.addEventListener('change', () => {
            this.visualMode = this.visualModeSelect.value;
            this.updateCanvasVisibility();
        });
        this.colorSchemeSelect.addEventListener('change', () => {
            this.colorScheme = this.colorSchemeSelect.value;
        });
        this.logScaleCheckbox.addEventListener('change', () => {
            this.logScale = this.logScaleCheckbox.checked;
        });
        this.smoothCheckbox.addEventListener('change', () => {
            this.smooth = this.smoothCheckbox.checked;
        });
        
        this.btnPlay.addEventListener('click', () => this.play());
        this.btnPause.addEventListener('click', () => this.pause());
        this.btnStop.addEventListener('click', () => this.stop());
        this.volumeSlider.addEventListener('input', () => {
            if (this.gainNode) {
                this.gainNode.gain.value = parseFloat(this.volumeSlider.value);
            }
        });
        this.progressBar.addEventListener('click', (e) => this.seek(e));
        
        this.btnCloseError.addEventListener('click', () => this.hideError());
        
        this.filterEnabledCheckbox.addEventListener('change', () => {
            this.filterEnabled = this.filterEnabledCheckbox.checked;
            this.filterControls.style.display = this.filterEnabled ? 'block' : 'none';
            this.filterStatus.textContent = this.filterEnabled ? '已开启' : '已关闭';
            this.filterStatus.classList.toggle('active', this.filterEnabled);
            this.spectrumLegend.style.display = this.filterEnabled ? 'flex' : 'none';
            if (!this.filterEnabled) {
                this.smoothedFilteredMagnitudes = [];
                this.currentFilteredMagnitudes = [];
            }
            if (this.audioProcessor && this.filterEnabled) {
                this.audioProcessor.reset_filter();
            }
        });
        
        this.cutoffSlider.addEventListener('input', () => {
            this.cutoffFreq = parseInt(this.cutoffSlider.value);
            this.cutoffValue.textContent = this.formatFrequency(this.cutoffFreq);
            if (this.audioProcessor) {
                this.audioProcessor.reset_filter();
            }
        });
        
        window.addEventListener('resize', () => this.resizeCanvases());
    }

    async initWasm() {
        this.showLoading('正在加载 WebAssembly 模块...');
        try {
            this.wasmModule = await initModule();
            this.audioProcessor = new AudioProcessor(this.fftSize);
            this.hideLoading();
        } catch (error) {
            console.error('WASM 加载失败:', error);
            this.hideLoading();
            this.showError('WebAssembly 模块加载失败，请确保已运行构建脚本');
        }
    }

    recreateProcessor() {
        if (this.audioProcessor) {
            this.audioProcessor.free();
        }
        this.audioProcessor = new AudioProcessor(this.fftSize);
        this.statFftSize.textContent = this.fftSize;
        this.smoothedMagnitudes = [];
        this.spectrogramData = null;
        this.spectrogramIndex = 0;
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    async processFile(file) {
        const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'];
        const validExtensions = ['.mp3', '.wav'];
        const fileName = file.name.toLowerCase();
        const isValid = validTypes.includes(file.type) || 
                        validExtensions.some(ext => fileName.endsWith(ext));
        
        if (!isValid) {
            this.showError('请上传 MP3 或 WAV 格式的音频文件');
            return;
        }

        this.showLoading('正在解码音频文件...');
        this.stop();
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.duration = this.audioBuffer.duration;
            this.durationEl.textContent = this.formatTime(this.duration);
            
            this.fileName.textContent = file.name;
            this.fileSize.textContent = this.formatFileSize(file.size);
            this.fileInfo.style.display = 'flex';
            this.playerSection.style.display = 'block';
            this.filterSection.style.display = 'block';
            
            this.statSampleRate.textContent = this.audioBuffer.sampleRate + ' Hz';
            this.statChannels.textContent = this.audioBuffer.numberOfChannels;
            this.statFftSize.textContent = this.fftSize;
            
            this.updateFrequencyAxis(this.audioBuffer.sampleRate);
            
            const nyquist = Math.floor(this.audioBuffer.sampleRate / 2);
            this.cutoffSlider.max = nyquist;
            if (this.cutoffFreq > nyquist) {
                this.cutoffFreq = nyquist;
                this.cutoffSlider.value = nyquist;
                this.cutoffValue.textContent = this.formatFrequency(nyquist);
            }
            
            this.generateSpectrogram();
            
            this.resizeCanvases();
            this.hideLoading();
        } catch (error) {
            console.error('音频解码失败:', error);
            this.hideLoading();
            this.showError('音频解码失败: ' + error.message);
        }
    }

    removeFile() {
        this.stop();
        this.audioBuffer = null;
        this.fileInfo.style.display = 'none';
        this.playerSection.style.display = 'none';
        this.filterSection.style.display = 'none';
        this.fileInput.value = '';
        
        this.statSampleRate.textContent = '-';
        this.statChannels.textContent = '-';
        this.statPeakFreq.textContent = '-';
        this.statProcessTime.textContent = '-';
        
        this.clearCanvas();
        this.spectrogramData = null;
        this.spectrogramIndex = 0;
        this.currentMagnitudes = [];
        this.currentFrequencies = [];
        this.currentFilteredMagnitudes = [];
        this.smoothedFilteredMagnitudes = [];
        
        this.updateFrequencyAxis(44100);
    }

    generateSpectrogram() {
        if (!this.audioBuffer || !this.audioProcessor) return;
        
        this.showLoading('正在生成频谱图...');
        
        setTimeout(() => {
            try {
                const channelData = this.audioBuffer.getChannelData(0);
                const sampleRate = this.audioBuffer.sampleRate;
                const hopSize = this.fftSize / 4;
                
                const startTime = performance.now();
                const resultJson = this.audioProcessor.process_batch(
                    channelData,
                    sampleRate,
                    hopSize
                );
                const result = JSON.parse(resultJson);
                const processTime = performance.now() - startTime;
                
                this.spectrogramData = result.frames;
                this.spectrogramIndex = 0;
                
                this.statProcessTime.textContent = processTime.toFixed(2) + ' ms';
                
                this.drawStaticSpectrum();
                this.hideLoading();
            } catch (error) {
                console.error('频谱图生成失败:', error);
                this.hideLoading();
                this.showError('频谱图生成失败: ' + error.message);
            }
        }, 50);
    }

    drawStaticSpectrum() {
        if (!this.spectrogramData || this.spectrogramData.length === 0) return;
        
        const numFrames = this.spectrogramData.length;
        const numBins = this.spectrogramData[0].length;
        const dpr = this.canvasDpr;
        
        this.spectrogramCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.spectrogramCanvas.width = numFrames * dpr;
        this.spectrogramCanvas.height = numBins * dpr;
        this.spectrogramCtx.scale(dpr, dpr);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = numFrames;
        tempCanvas.height = numBins;
        const tempCtx = tempCanvas.getContext('2d');
        
        const imageData = tempCtx.createImageData(numFrames, numBins);
        
        let maxMag = 0;
        for (let i = 0; i < numFrames; i++) {
            for (let j = 0; j < numBins; j++) {
                const mag = this.spectrogramData[i][j];
                if (mag > maxMag) maxMag = mag;
            }
        }
        
        for (let i = 0; i < numFrames; i++) {
            for (let j = 0; j < numBins; j++) {
                const y = numBins - 1 - j;
                const idx = (y * numFrames + i) * 4;
                const mag = this.spectrogramData[i][j];
                const normalized = Math.log1p(mag) / Math.log1p(maxMag);
                const color = this.getSpectrogramColor(normalized);
                
                imageData.data[idx] = color.r;
                imageData.data[idx + 1] = color.g;
                imageData.data[idx + 2] = color.b;
                imageData.data[idx + 3] = 255;
            }
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        this.spectrogramCtx.drawImage(tempCanvas, 0, 0, numFrames, numBins, 0, 0, numFrames, numBins);
    }

    getSpectrogramColor(value) {
        if (value < 0.25) {
            return { r: 0, g: 0, b: Math.floor(value * 4 * 255) };
        } else if (value < 0.5) {
            const t = (value - 0.25) * 4;
            return { r: 0, g: Math.floor(t * 255), b: 255 };
        } else if (value < 0.75) {
            const t = (value - 0.5) * 4;
            return { r: Math.floor(t * 255), g: 255, b: Math.floor(255 * (1 - t)) };
        } else {
            const t = (value - 0.75) * 4;
            return { r: 255, g: Math.floor(255 * (1 - t)), b: 0 };
        }
    }

    play() {
        if (!this.audioBuffer || this.isPlaying) return;
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = this.audioBuffer;
        
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = parseFloat(this.volumeSlider.value);
        
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        
        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        
        this.channelData = this.audioBuffer.getChannelData(0);
        this.bufferSampleRate = this.audioBuffer.sampleRate;
        
        this.sourceNode.start(0, this.currentTime);
        this.startTime = this.audioContext.currentTime - this.currentTime;
        this.isPlaying = true;
        
        this.btnPlay.style.display = 'none';
        this.btnPause.style.display = 'inline-block';
        
        this.sourceNode.onended = () => {
            if (this.isPlaying) {
                this.stop();
            }
        };
        
        this.animate();
    }

    pause() {
        if (!this.isPlaying) return;
        
        this.currentTime = this.audioContext.currentTime - this.startTime;
        this.sourceNode.stop();
        this.isPlaying = false;
        
        this.btnPlay.style.display = 'inline-block';
        this.btnPause.style.display = 'none';
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }

    stop() {
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
            } catch (e) {}
        }
        
        this.isPlaying = false;
        this.currentTime = 0;
        this.progressFill.style.width = '0%';
        this.currentTimeEl.textContent = '0:00';
        
        this.btnPlay.style.display = 'inline-block';
        this.btnPause.style.display = 'none';
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        this.clearCanvas();
        this.spectrogramIndex = 0;
    }

    seek(e) {
        if (!this.audioBuffer) return;
        
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.currentTime = percent * this.duration;
        
        if (this.isPlaying) {
            this.pause();
            this.play();
        } else {
            this.progressFill.style.width = (percent * 100) + '%';
            this.currentTimeEl.textContent = this.formatTime(this.currentTime);
        }
    }

    animate() {
        if (!this.isPlaying) return;
        
        this.animationId = requestAnimationFrame(() => this.animate());
        
        this.currentTime = this.audioContext.currentTime - this.startTime;
        const progress = (this.currentTime / this.duration) * 100;
        this.progressFill.style.width = progress + '%';
        this.currentTimeEl.textContent = this.formatTime(this.currentTime);
        
        if (this.audioProcessor && this.channelData) {
            const sampleIndex = Math.floor(this.currentTime * this.bufferSampleRate);
            const fftSize = this.fftSize;
            
            let samples;
            if (sampleIndex + fftSize <= this.channelData.length) {
                samples = this.channelData.slice(sampleIndex, sampleIndex + fftSize);
            } else {
                samples = new Float32Array(fftSize);
                const available = this.channelData.length - sampleIndex;
                if (available > 0) {
                    samples.set(this.channelData.slice(sampleIndex, sampleIndex + available));
                }
            }
            
            const startTime = performance.now();
            let resultJson;
            
            if (this.filterEnabled) {
                resultJson = this.audioProcessor.process_with_filter(
                    samples,
                    this.bufferSampleRate,
                    this.cutoffFreq
                );
            } else {
                resultJson = this.audioProcessor.process(
                    samples,
                    this.bufferSampleRate
                );
            }
            
            const result = JSON.parse(resultJson);
            const processTime = performance.now() - startTime;
            
            this.statProcessTime.textContent = processTime.toFixed(2) + ' ms';
            
            if (this.filterEnabled && result.original_magnitudes) {
                this.updateFilteredVisualization(result);
            } else {
                this.updateVisualization(result);
            }
        }
    }

    updateVisualization(result) {
        const { magnitudes, frequencies } = result;
        
        let peakIndex = 0;
        let peakValue = 0;
        for (let i = 0; i < magnitudes.length; i++) {
            if (magnitudes[i] > peakValue) {
                peakValue = magnitudes[i];
                peakIndex = i;
            }
        }
        this.statPeakFreq.textContent = frequencies[peakIndex].toFixed(1) + ' Hz';
        
        if (this.smooth && this.smoothedMagnitudes.length === magnitudes.length) {
            for (let i = 0; i < magnitudes.length; i++) {
                this.smoothedMagnitudes[i] = this.smoothedMagnitudes[i] * 0.7 + magnitudes[i] * 0.3;
            }
        } else {
            this.smoothedMagnitudes = [...magnitudes];
        }
        
        const displayMagnitudes = this.smooth ? this.smoothedMagnitudes : magnitudes;
        
        this.currentMagnitudes = [...displayMagnitudes];
        this.currentFrequencies = [...frequencies];
        
        if (this.visualMode === 'spectrogram') {
            this.drawSpectrogramScroll(displayMagnitudes);
        } else {
            this.drawSpectrum(displayMagnitudes, frequencies);
        }
    }

    updateFilteredVisualization(result) {
        const { original_magnitudes, filtered_magnitudes, frequencies, cutoff_freq } = result;
        
        let peakIndex = 0;
        let peakValue = 0;
        for (let i = 0; i < filtered_magnitudes.length; i++) {
            if (filtered_magnitudes[i] > peakValue) {
                peakValue = filtered_magnitudes[i];
                peakIndex = i;
            }
        }
        this.statPeakFreq.textContent = frequencies[peakIndex].toFixed(1) + ' Hz';
        
        if (this.smooth && this.smoothedMagnitudes.length === original_magnitudes.length) {
            for (let i = 0; i < original_magnitudes.length; i++) {
                this.smoothedMagnitudes[i] = this.smoothedMagnitudes[i] * 0.7 + original_magnitudes[i] * 0.3;
                this.smoothedFilteredMagnitudes[i] = this.smoothedFilteredMagnitudes[i] * 0.7 + filtered_magnitudes[i] * 0.3;
            }
        } else {
            this.smoothedMagnitudes = [...original_magnitudes];
            this.smoothedFilteredMagnitudes = [...filtered_magnitudes];
        }
        
        const displayOriginal = this.smooth ? this.smoothedMagnitudes : original_magnitudes;
        const displayFiltered = this.smooth ? this.smoothedFilteredMagnitudes : filtered_magnitudes;
        
        this.currentMagnitudes = [...displayOriginal];
        this.currentFilteredMagnitudes = [...displayFiltered];
        this.currentFrequencies = [...frequencies];
        
        this.drawFilteredSpectrum(displayOriginal, displayFiltered, frequencies, cutoff_freq);
    }

    drawSpectrum(magnitudes, frequencies) {
        const ctx = this.spectrumCtx;
        const dpr = this.canvasDpr;
        const width = this.spectrumCanvas.width / dpr;
        const height = this.spectrumCanvas.height / dpr;
        
        ctx.fillStyle = 'rgba(10, 10, 26, 0.3)';
        ctx.fillRect(0, 0, width, height);
        
        const maxMag = Math.max(...magnitudes, 1);
        const numBars = magnitudes.length;
        
        if (this.visualMode === 'bars') {
            const barWidth = width / numBars;
            
            for (let i = 0; i < numBars; i++) {
                let x;
                if (this.logScale) {
                    const minFreq = 20;
                    const maxFreq = Math.max(frequencies[numBars - 1], 20000);
                    const logMin = Math.log10(minFreq);
                    const logMax = Math.log10(maxFreq);
                    const logPos = Math.log10(Math.max(frequencies[i], minFreq));
                    x = ((logPos - logMin) / (logMax - logMin)) * width;
                } else {
                    x = (i / numBars) * width;
                }
                
                const barHeight = (magnitudes[i] / maxMag) * (height - 20);
                const actualBarWidth = Math.max(barWidth * 0.8, 2);
                
                const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
                const color = this.getColor(i / numBars);
                gradient.addColorStop(0, color.dark);
                gradient.addColorStop(1, color.light);
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, height - barHeight, actualBarWidth, barHeight);
                
                ctx.fillStyle = color.light;
                ctx.fillRect(x, height - barHeight - 2, actualBarWidth, 2);
            }
        } else if (this.visualMode === 'line') {
            ctx.beginPath();
            ctx.strokeStyle = this.getColor(0).light;
            ctx.lineWidth = 2;
            
            for (let i = 0; i < numBars; i++) {
                let x;
                if (this.logScale) {
                    const minFreq = 20;
                    const maxFreq = Math.max(frequencies[numBars - 1], 20000);
                    const logMin = Math.log10(minFreq);
                    const logMax = Math.log10(maxFreq);
                    const logPos = Math.log10(Math.max(frequencies[i], minFreq));
                    x = ((logPos - logMin) / (logMax - logMin)) * width;
                } else {
                    x = (i / numBars) * width;
                }
                
                const y = height - (magnitudes[i] / maxMag) * (height - 20);
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
            
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, this.getColor(0).light + '40');
            gradient.addColorStop(1, this.getColor(0).dark + '00');
            
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();
        }
        
        this.drawGrid(ctx, width, height, frequencies);
    }

    drawFilteredSpectrum(originalMags, filteredMags, frequencies, cutoffFreq) {
        const ctx = this.spectrumCtx;
        const dpr = this.canvasDpr;
        const width = this.spectrumCanvas.width / dpr;
        const height = this.spectrumCanvas.height / dpr;
        
        ctx.fillStyle = 'rgba(10, 10, 26, 0.4)';
        ctx.fillRect(0, 0, width, height);
        
        const maxOrig = Math.max(...originalMags, 1);
        const maxFilt = Math.max(...filteredMags, 1);
        const maxMag = Math.max(maxOrig, maxFilt);
        const numBars = originalMags.length;
        const barWidth = width / numBars;
        
        for (let i = 0; i < numBars; i++) {
            let x;
            if (this.logScale) {
                const minFreq = 20;
                const maxFreq = Math.max(frequencies[numBars - 1], 20000);
                const logMin = Math.log10(minFreq);
                const logMax = Math.log10(maxFreq);
                const logPos = Math.log10(Math.max(frequencies[i], minFreq));
                x = ((logPos - logMin) / (logMax - logMin)) * width;
            } else {
                x = (i / numBars) * width;
            }
            
            const origHeight = (originalMags[i] / maxMag) * (height - 20);
            const filtHeight = (filteredMags[i] / maxMag) * (height - 20);
            const actualBarWidth = Math.max(barWidth * 0.8, 2);
            
            const origGradient = ctx.createLinearGradient(0, height, 0, height - origHeight);
            origGradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
            origGradient.addColorStop(1, 'rgba(0, 212, 255, 0.6)');
            ctx.fillStyle = origGradient;
            ctx.fillRect(x, height - origHeight, actualBarWidth, origHeight);
            
            const filtGradient = ctx.createLinearGradient(0, height, 0, height - filtHeight);
            filtGradient.addColorStop(0, 'rgba(255, 107, 107, 0.4)');
            filtGradient.addColorStop(1, 'rgba(255, 107, 107, 0.85)');
            ctx.fillStyle = filtGradient;
            ctx.fillRect(x, height - filtHeight, actualBarWidth, filtHeight);
            
            ctx.fillStyle = 'rgba(0, 212, 255, 0.9)';
            ctx.fillRect(x, height - origHeight - 1, actualBarWidth, 1);
            
            ctx.fillStyle = 'rgba(255, 107, 107, 1)';
            ctx.fillRect(x, height - filtHeight - 1, actualBarWidth, 1);
        }
        
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < numBars; i++) {
            let x;
            if (this.logScale) {
                const minFreq = 20;
                const maxFreq = Math.max(frequencies[numBars - 1], 20000);
                const logMin = Math.log10(minFreq);
                const logMax = Math.log10(maxFreq);
                const logPos = Math.log10(Math.max(frequencies[i], minFreq));
                x = ((logPos - logMin) / (logMax - logMin)) * width;
            } else {
                x = (i / numBars) * width;
            }
            const y = height - (originalMags[i] / maxMag) * (height - 20);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.9)';
        ctx.lineWidth = 2;
        for (let i = 0; i < numBars; i++) {
            let x;
            if (this.logScale) {
                const minFreq = 20;
                const maxFreq = Math.max(frequencies[numBars - 1], 20000);
                const logMin = Math.log10(minFreq);
                const logMax = Math.log10(maxFreq);
                const logPos = Math.log10(Math.max(frequencies[i], minFreq));
                x = ((logPos - logMin) / (logMax - logMin)) * width;
            } else {
                x = (i / numBars) * width;
            }
            const y = height - (filteredMags[i] / maxMag) * (height - 20);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        let cutoffX;
        if (this.logScale) {
            const minFreq = 20;
            const maxFreq = Math.max(frequencies[numBars - 1], 20000);
            const logMin = Math.log10(minFreq);
            const logMax = Math.log10(maxFreq);
            const logCutoff = Math.log10(Math.max(cutoffFreq, minFreq));
            cutoffX = ((logCutoff - logMin) / (logMax - logMin)) * width;
        } else {
            cutoffX = (cutoffFreq / Math.max(frequencies[numBars - 1], 20000)) * width;
        }
        
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#ffd93d';
        ctx.lineWidth = 2;
        ctx.moveTo(cutoffX, 0);
        ctx.lineTo(cutoffX, height);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#ffd93d';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
            this.formatFrequency(cutoffFreq),
            Math.min(cutoffX, width - 40),
            14
        );
        
        this.drawGrid(ctx, width, height, frequencies);
    }

    drawSpectrogramScroll(magnitudes) {
        const ctx = this.spectrumCtx;
        const dpr = this.canvasDpr;
        const pixelWidth = this.spectrumCanvas.width;
        const pixelHeight = this.spectrumCanvas.height;
        const width = pixelWidth / dpr;
        const height = pixelHeight / dpr;
        
        const imageData = ctx.getImageData(dpr, 0, pixelWidth - dpr, pixelHeight);
        ctx.putImageData(imageData, 0, 0);
        
        const maxMag = Math.max(...magnitudes, 1);
        const numBins = magnitudes.length;
        
        for (let i = 0; i < numBins; i++) {
            const y = height - Math.floor((i / numBins) * height);
            const normalized = magnitudes[i] / maxMag;
            const color = this.getSpectrogramColor(Math.min(normalized, 1));
            
            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            ctx.fillRect(width - 1, y, 1, Math.max(1, height / numBins));
        }
    }

    drawGrid(ctx, width, height, frequencies) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        const freqMarkers = [20, 100, 500, 1000, 5000, 10000, 20000];
        
        for (const freq of freqMarkers) {
            let x;
            if (this.logScale) {
                const minFreq = 20;
                const maxFreq = Math.max(frequencies[frequencies.length - 1], 20000);
                const logMin = Math.log10(minFreq);
                const logMax = Math.log10(maxFreq);
                const logPos = Math.log10(freq);
                x = ((logPos - logMin) / (logMax - logMin)) * width;
            } else {
                x = (freq / Math.max(frequencies[frequencies.length - 1], 20000)) * width;
            }
            
            if (x >= 0 && x <= width) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        }
        
        for (let i = 0; i < 5; i++) {
            const y = (i / 4) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    getColor(position) {
        const schemes = {
            rainbow: [
                { pos: 0.0, r: 139, g: 92, b: 246 },
                { pos: 0.2, r: 59, g: 130, b: 246 },
                { pos: 0.4, r: 0, g: 212, b: 255 },
                { pos: 0.6, r: 46, g: 213, b: 115 },
                { pos: 0.8, r: 255, g: 195, b: 18 },
                { pos: 1.0, r: 255, g: 71, b: 87 }
            ],
            fire: [
                { pos: 0.0, r: 26, g: 26, b: 46 },
                { pos: 0.3, r: 255, g: 71, b: 87 },
                { pos: 0.6, r: 255, g: 165, b: 2 },
                { pos: 1.0, r: 255, g: 255, b: 0 }
            ],
            ocean: [
                { pos: 0.0, r: 15, g: 52, b: 96 },
                { pos: 0.5, r: 0, g: 153, b: 204 },
                { pos: 1.0, r: 0, g: 255, b: 200 }
            ],
            neon: [
                { pos: 0.0, r: 0, g: 255, b: 255 },
                { pos: 0.5, r: 255, g: 0, b: 255 },
                { pos: 1.0, r: 0, g: 255, b: 128 }
            ]
        };
        
        const scheme = schemes[this.colorScheme];
        
        for (let i = 0; i < scheme.length - 1; i++) {
            if (position >= scheme[i].pos && position <= scheme[i + 1].pos) {
                const t = (position - scheme[i].pos) / (scheme[i + 1].pos - scheme[i].pos);
                const r = Math.floor(scheme[i].r + t * (scheme[i + 1].r - scheme[i].r));
                const g = Math.floor(scheme[i].g + t * (scheme[i + 1].g - scheme[i].g));
                const b = Math.floor(scheme[i].b + t * (scheme[i + 1].b - scheme[i].b));
                return {
                    light: `rgb(${r}, ${g}, ${b})`,
                    dark: `rgb(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.6)})`
                };
            }
        }
        
        return { light: 'rgb(0, 212, 255)', dark: 'rgb(0, 127, 153)' };
    }

    updateCanvasVisibility() {
        if (this.visualMode === 'spectrogram') {
            this.spectrumCanvas.style.display = 'none';
            this.spectrogramCanvas.style.display = 'block';
        } else {
            this.spectrumCanvas.style.display = 'block';
            this.spectrogramCanvas.style.display = 'none';
        }
    }

    clearCanvas() {
        const dpr = this.canvasDpr;
        const spectrumWidth = this.spectrumCanvas.width / dpr;
        const spectrumHeight = this.spectrumCanvas.height / dpr;
        const spectrogramWidth = this.spectrogramCanvas.width / dpr;
        const spectrogramHeight = this.spectrogramCanvas.height / dpr;
        
        this.spectrumCtx.fillStyle = '#0a0a1a';
        this.spectrumCtx.fillRect(0, 0, spectrumWidth, spectrumHeight);
        
        this.spectrogramCtx.fillStyle = '#0a0a1a';
        this.spectrogramCtx.fillRect(0, 0, spectrogramWidth, spectrogramHeight);
    }

    resizeCanvases() {
        const container = this.spectrumCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        const dpr = window.devicePixelRatio || 1;
        this.canvasDpr = dpr;
        
        this.spectrumCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.spectrumCanvas.width = rect.width * dpr;
        this.spectrumCanvas.height = 400 * dpr;
        this.spectrumCtx.scale(dpr, dpr);
        
        this.spectrogramCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.spectrogramCanvas.width = rect.width * dpr;
        this.spectrogramCanvas.height = 200 * dpr;
        this.spectrogramCtx.scale(dpr, dpr);
        
        this.clearCanvas();
        
        if (this.spectrogramData && this.visualMode === 'spectrogram') {
            this.drawStaticSpectrum();
        }
        
        if (this.currentMagnitudes.length > 0 && this.currentFrequencies.length > 0) {
            if (this.filterEnabled && this.currentFilteredMagnitudes.length > 0) {
                this.drawFilteredSpectrum(
                    this.currentMagnitudes,
                    this.currentFilteredMagnitudes,
                    this.currentFrequencies,
                    this.cutoffFreq
                );
            } else if (this.visualMode === 'spectrogram') {
                this.drawSpectrogramScroll(this.currentMagnitudes);
            } else {
                this.drawSpectrum(this.currentMagnitudes, this.currentFrequencies);
            }
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    formatFrequency(hz) {
        if (hz >= 1000) {
            return (hz / 1000).toFixed(1) + ' kHz';
        }
        return hz + ' Hz';
    }

    updateFrequencyAxis(sampleRate) {
        const nyquist = sampleRate / 2;
        
        let labels;
        if (nyquist <= 24000) {
            labels = ['20Hz', '100Hz', '500Hz', '1kHz', '5kHz', '10kHz', '20kHz'];
        } else if (nyquist <= 48000) {
            labels = ['20Hz', '100Hz', '1kHz', '5kHz', '10kHz', '20kHz', '40kHz'];
        } else if (nyquist <= 96000) {
            labels = ['20Hz', '100Hz', '1kHz', '10kHz', '20kHz', '40kHz', '80kHz'];
        } else {
            labels = ['20Hz', '100Hz', '1kHz', '20kHz', '50kHz', '100kHz', '192kHz'];
        }
        
        for (let i = 0; i < this.freqLabels.length; i++) {
            this.freqLabels[i].textContent = labels[i];
        }
    }

    showLoading(text) {
        this.loadingText.textContent = text;
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    showError(message) {
        this.errorText.textContent = message;
        this.errorMessage.style.display = 'flex';
        
        setTimeout(() => this.hideError(), 5000);
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AudioSpectrumApp();
});
