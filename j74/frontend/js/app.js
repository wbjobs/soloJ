class FitsApp {
    constructor() {
        this.apiBase = 'http://localhost:8080/api/fits';
        this.selectedFile = null;
        this.hdus = [];
        this.imageHduIndex = 0;
        this.spectrumHduIndex = 1;
        this.heatmapRenderer = null;
        this.spectrumRenderer = null;
        this.currentHduIndex = 0;
        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.heatmapRenderer = new HeatmapRenderer('heatmapCanvas', 'colorbar', 'pixelInfo');
        this.spectrumRenderer = new SpectrumRenderer('spectrumChart');
    }

    bindElements() {
        this.uploadBox = document.getElementById('uploadBox');
        this.fileInput = document.getElementById('fitsFileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.uploadInfo = document.getElementById('uploadInfo');
        this.vizSection = document.getElementById('vizSection');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.hduTabs = document.getElementById('hduTabs');
        this.headerTable = document.getElementById('headerTable');
        this.imageHduSelect = document.getElementById('imageHduSelect');
        this.spectrumHduSelect = document.getElementById('spectrumHduSelect');
        this.spectrumPanel = document.getElementById('spectrumPanel');
        this.contrastSlider = document.getElementById('contrastSlider');
        this.brightnessSlider = document.getElementById('brightnessSlider');
        this.colormapSelect = document.getElementById('colormapSelect');
    }

    bindEvents() {
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.uploadBox.addEventListener('click', (e) => {
            if (e.target === this.uploadBox || e.target.parentElement === this.uploadBox) {
                this.fileInput.click();
            }
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        this.uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadBox.classList.add('drag-over');
        });

        this.uploadBox.addEventListener('dragleave', () => {
            this.uploadBox.classList.remove('drag-over');
        });

        this.uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadBox.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });

        this.imageHduSelect.addEventListener('change', (e) => {
            this.imageHduIndex = parseInt(e.target.value);
            this.loadImageData();
        });

        this.spectrumHduSelect.addEventListener('change', (e) => {
            this.spectrumHduIndex = parseInt(e.target.value);
            this.loadSpectrumData();
        });

        this.contrastSlider.addEventListener('input', (e) => {
            this.heatmapRenderer.setContrast(e.target.value);
        });

        this.brightnessSlider.addEventListener('input', (e) => {
            this.heatmapRenderer.setBrightness(e.target.value);
        });

        this.colormapSelect.addEventListener('change', (e) => {
            this.heatmapRenderer.setColormap(e.target.value);
        });
    }

    handleFile(file) {
        const validExts = ['.fits', '.fit', '.fts'];
        const fileName = file.name.toLowerCase();
        if (!validExts.some(ext => fileName.endsWith(ext))) {
            this.showMessage('请上传 .fits, .fit 或 .fts 格式的文件', 'error');
            return;
        }

        this.selectedFile = file;
        this.showMessage(`已选择文件: ${file.name} (${this.formatSize(file.size)})`, 'success');
        this.processFile();
    }

    async processFile() {
        this.showLoading(true);
        try {
            await this.loadHeaders();
            await this.loadImageData();
            this.tryLoadSpectrum();
            this.vizSection.style.display = 'block';
        } catch (error) {
            this.showMessage('解析 FITS 文件失败: ' + error.message, 'error');
            console.error(error);
        } finally {
            this.showLoading(false);
        }
    }

    async loadHeaders() {
        const formData = new FormData();
        formData.append('file', this.selectedFile);

        const response = await fetch(`${this.apiBase}/headers`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Headers request failed');
        }

        this.hdus = await response.json();
        this.renderHduTabs();
        this.renderHduSelects();
        this.showHduHeaders(0);
    }

    async loadImageData() {
        const formData = new FormData();
        formData.append('file', this.selectedFile);
        formData.append('hduIndex', this.imageHduIndex);

        const response = await fetch(`${this.apiBase}/image`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Image data request failed');
        }

        const data = await response.json();
        this.heatmapRenderer.setData(data.data, data.width, data.height, data.min, data.max);
    }

    async tryLoadSpectrum() {
        const potentialHdus = this.hdus
            .map((hdu, idx) => ({ ...hdu, idx }))
            .filter(h => h.imageType === 'BINARY_TABLE' || h.imageType === 'IMAGE');

        if (potentialHdus.length === 0) {
            return;
        }

        let foundSpectrum = false;
        for (const hdu of potentialHdus) {
            try {
                await this.loadSpectrumDataForHdu(hdu.idx);
                this.spectrumHduIndex = hdu.idx;
                this.spectrumHduSelect.value = hdu.idx;
                this.spectrumPanel.style.display = 'block';
                foundSpectrum = true;
                break;
            } catch (e) {
                console.log(`HDU ${hdu.idx} 没有光谱数据`);
            }
        }

        if (!foundSpectrum) {
            this.spectrumPanel.style.display = 'none';
        }
    }

    async loadSpectrumData() {
        try {
            await this.loadSpectrumDataForHdu(this.spectrumHduIndex);
            this.spectrumPanel.style.display = 'block';
        } catch (e) {
            console.error('Failed to load spectrum:', e);
        }
    }

    async loadSpectrumDataForHdu(hduIndex) {
        const formData = new FormData();
        formData.append('file', this.selectedFile);
        formData.append('hduIndex', hduIndex);

        const response = await fetch(`${this.apiBase}/spectrum`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Spectrum data request failed');
        }

        const data = await response.json();
        if (data.wavelengths && data.wavelengths.length > 0) {
            this.spectrumRenderer.render(data.wavelengths, data.fluxes, {
                ctype1: data.ctype1 || ''
            });
        } else {
            throw new Error('No spectrum data available');
        }
    }

    renderHduTabs() {
        this.hduTabs.innerHTML = '';
        this.hdus.forEach((hdu, idx) => {
            const tab = document.createElement('div');
            tab.className = 'hdu-tab' + (idx === 0 ? ' active' : '');
            tab.textContent = `HDU ${idx}: ${hdu.hduType.replace('HDU', '')}`;
            tab.addEventListener('click', () => {
                document.querySelectorAll('.hdu-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.showHduHeaders(idx);
            });
            this.hduTabs.appendChild(tab);
        });
    }

    renderHduSelects() {
        const imageHdus = this.hdus
            .map((hdu, idx) => ({ ...hdu, idx }))
            .filter(h => h.imageType === 'IMAGE');

        this.imageHduSelect.innerHTML = '';
        imageHdus.forEach(hdu => {
            const opt = document.createElement('option');
            opt.value = hdu.idx;
            opt.textContent = `HDU ${hdu.idx} (${hdu.axes ? hdu.axes.join('x') : 'N/A'})`;
            this.imageHduSelect.appendChild(opt);
        });

        this.spectrumHduSelect.innerHTML = '';
        this.hdus.forEach((hdu, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `HDU ${idx}: ${hdu.hduType.replace('HDU', '')}`;
            this.spectrumHduSelect.appendChild(opt);
        });
    }

    showHduHeaders(idx) {
        this.currentHduIndex = idx;
        const hdu = this.hdus[idx];
        if (!hdu || !hdu.headers) return;

        this.headerTable.innerHTML = '';
        Object.entries(hdu.headers).forEach(([key, value]) => {
            const row = document.createElement('div');
            row.className = 'header-row';
            row.innerHTML = `
                <span class="header-key">${key}</span>
                <span class="header-value">${value || ''}</span>
            `;
            this.headerTable.appendChild(row);
        });
    }

    showMessage(msg, type) {
        this.uploadInfo.textContent = msg;
        this.uploadInfo.className = 'upload-info ' + type;
    }

    showLoading(show) {
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.fitsApp = new FitsApp();
});
