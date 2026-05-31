class CompareApp {
    constructor() {
        this.apiBase = 'http://localhost:8080/api/fits';
        this.wsBase = 'ws://localhost:8080/ws/psnr';
        this.file1 = null;
        this.file2 = null;
        this.renderer = null;
        this.ws = null;
        this.init();
    }

    init() {
        this.renderer = new CompareRenderer('compareCanvas');
        this.bindUpload('uploadBox1', 'fitsFile1', 'uploadInfo1', 1);
        this.bindUpload('uploadBox2', 'fitsFile2', 'uploadInfo2', 2);

        document.getElementById('startCompareBtn').addEventListener('click', () => this.startCompare());
        document.getElementById('opacitySlider').addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            document.getElementById('opacityValue').textContent = Math.round(v * 100) + '%';
            document.getElementById('opacityTrack').style.background =
                `linear-gradient(to right, rgba(239,68,68,${1-v}) ${v*100}%, rgba(59,130,246,${v}) ${v*100}%)`;
            this.renderer.setOpacity(v);
        });
        document.getElementById('colormapSelect').addEventListener('change', (e) => {
            this.renderer.setColormap(e.target.value);
        });
    }

    bindUpload(boxId, inputId, infoId, fileNum) {
        const box = document.getElementById(boxId);
        const input = document.getElementById(inputId);

        box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag-over'); });
        box.addEventListener('dragleave', () => box.classList.remove('drag-over'));
        box.addEventListener('drop', (e) => {
            e.preventDefault();
            box.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) this.setFile(e.dataTransfer.files[0], fileNum, infoId);
        });
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.setFile(e.target.files[0], fileNum, infoId);
        });
    }

    setFile(file, num, infoId) {
        const validExts = ['.fits', '.fit', '.fts'];
        const name = file.name.toLowerCase();
        if (!validExts.some(ext => name.endsWith(ext))) {
            this.showInfo(infoId, '请上传 .fits 格式文件', 'error');
            return;
        }
        if (num === 1) this.file1 = file;
        else this.file2 = file;
        this.showInfo(infoId, `${file.name} (${this.fmtSize(file.size)})`, 'success');
        this.checkReady();
    }

    checkReady() {
        document.getElementById('startCompareBtn').disabled = !(this.file1 && this.file2);
    }

    async startCompare() {
        this.showLoading(true, '正在加载双波段数据...');
        try {
            const [img1, img2] = await Promise.all([
                this.loadImage(this.file1),
                this.loadImage(this.file2)
            ]);

            const commonW = Math.min(img1.width, img2.width);
            const commonH = Math.min(img1.height, img2.height);

            const d1 = this.cropData(img1.data, img1.width, img1.height, commonW, commonH);
            const d2 = this.cropData(img2.data, img2.width, img2.height, commonW, commonH);

            this.renderer.setData(d1, d2, commonW, commonH);
            document.getElementById('vizSection').style.display = 'block';

            this.startPsnrTask();
        } catch (err) {
            alert('加载失败: ' + err.message);
            console.error(err);
        } finally {
            this.showLoading(false);
        }
    }

    cropData(data, ow, oh, tw, th) {
        if (ow === tw && oh === th) return data;
        const result = [];
        for (let y = 0; y < th; y++) {
            const row = [];
            for (let x = 0; x < tw; x++) {
                row.push(y < oh && x < ow ? data[y][x] : 0);
            }
            result.push(row);
        }
        return result;
    }

    async loadImage(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('hduIndex', '0');

        const resp = await fetch(`${this.apiBase}/image`, { method: 'POST', body: formData });
        if (!resp.ok) throw new Error('加载图像数据失败: ' + file.name);
        return await resp.json();
    }

    startPsnrTask() {
        document.getElementById('progressBar').style.width = '0%';
        document.getElementById('progressText').textContent = '连接 WebSocket...';
        document.getElementById('psnrValue').textContent = '--';
        document.getElementById('mseValue').textContent = '--';

        this.connectWs();

        const formData = new FormData();
        formData.append('file1', this.file1);
        formData.append('file2', this.file2);
        formData.append('hduIndex1', '0');
        formData.append('hduIndex2', '0');

        fetch(`${this.apiBase}/compare`, { method: 'POST', body: formData })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    document.getElementById('progressText').textContent = '错误: ' + data.error;
                } else {
                    document.getElementById('progressText').textContent = '任务已提交: ' + data.taskId;
                }
            })
            .catch(err => {
                document.getElementById('progressText').textContent = '请求失败: ' + err.message;
            });
    }

    connectWs() {
        if (this.ws) {
            try { this.ws.close(); } catch(e) {}
        }

        this.ws = new WebSocket(this.wsBase);

        this.ws.onopen = () => {
            document.getElementById('progressText').textContent = 'WebSocket 已连接，等待计算...';
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleWsMessage(msg);
            } catch(e) {
                console.error('WS parse error', e);
            }
        };

        this.ws.onerror = (err) => {
            document.getElementById('progressText').textContent = 'WebSocket 连接出错';
        };

        this.ws.onclose = () => {
            document.getElementById('progressText').textContent =
                document.getElementById('progressText').textContent + ' (连接已关闭)';
        };
    }

    handleWsMessage(msg) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');

        if (msg.progress !== undefined) {
            progressBar.style.width = msg.progress + '%';
        }

        const statusMap = {
            'READING_FILE_1': '正在读取文件 A...',
            'READING_FILE_2': '正在读取文件 B...',
            'COMPUTING': '正在计算 PSNR...',
            'FINALIZING': '正在汇总结果...',
            'COMPLETED': '计算完成！',
        };

        if (msg.status && statusMap[msg.status]) {
            progressText.textContent = statusMap[msg.status] + ` (${Math.round(msg.progress || 0)}%)`;
        }

        if (msg.status === 'COMPLETED') {
            progressBar.style.width = '100%';

            const psnrEl = document.getElementById('psnrValue');
            const mseEl = document.getElementById('mseValue');

            if (msg.psnr !== undefined) {
                if (msg.psnr === 'Infinity' || msg.psnr > 999) {
                    psnrEl.textContent = '∞';
                } else {
                    psnrEl.textContent = parseFloat(msg.psnr).toFixed(2);
                }
                psnrEl.classList.remove('error');
            }

            if (msg.mse !== undefined) {
                mseEl.textContent = parseFloat(msg.mse).toExponential(3);
            }
        }

        if (msg.status && msg.status.startsWith('ERROR')) {
            progressBar.style.width = '100%';
            progressBar.style.background = 'linear-gradient(90deg, #ef4444, #f97316)';
            progressText.textContent = '计算出错: ' + msg.status;
            document.getElementById('psnrValue').textContent = 'ERR';
            document.getElementById('psnrValue').classList.add('error');
        }
    }

    showInfo(id, msg, type) {
        const el = document.getElementById(id);
        el.textContent = msg;
        el.className = 'upload-info ' + type;
    }

    showLoading(show) {
        document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
    }

    fmtSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.compareApp = new CompareApp();
});
