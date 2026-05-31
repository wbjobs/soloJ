(async function () {
    const $ = (s) => document.querySelector(s);

    const MAX_IMAGE_PIXELS = 4096 * 4096;
    const MAX_MESSAGE_BYTES = 1024 * 1024;
    const COMPRESS_THRESHOLD_PX = 2048 * 2048;
    const TARGET_MAX_PX = 2048 * 2048;

    let wasmModule = null;
    let useWasm = false;
    let loadedImage = null;
    let imageData = null;
    let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    function getBit(imgData, idx) {
        const px = (idx / 3) | 0;
        const ch = idx % 3;
        const base = px * 4;
        return imgData[base + ch] & 1;
    }

    function xorWithPassword(data, password) {
        if (!password || password.length === 0) return;
        const pwdBytes = new TextEncoder().encode(password);
        if (pwdBytes.length === 0) return;
        for (let i = 0; i < data.length; i++) {
            data[i] ^= pwdBytes[i % pwdBytes.length];
        }
    }

    function encodeLsbJS(imgData, message, password) {
        const msgBytes = new TextEncoder().encode(message);
        xorWithPassword(msgBytes, password);

        const totalPixels = imgData.length / 4;

        if (totalPixels > MAX_IMAGE_PIXELS) {
            throw new Error('Image too large: maximum 4096x4096 pixels');
        }
        if (msgBytes.length > MAX_MESSAGE_BYTES) {
            throw new Error('Message too large: maximum 1MB');
        }
        if (totalPixels === 0) {
            throw new Error('Invalid image data');
        }

        const msgLen = msgBytes.length;
        const neededBits = 32 + msgBytes.length * 8;
        const maxBits = totalPixels * 3;
        if (neededBits > maxBits) {
            throw new Error('Insufficient image capacity');
        }

        const result = new Uint8Array(imgData.buffer, imgData.byteOffset, imgData.byteLength);

        let bitIdx = 0;
        for (let i = 31; i >= 0; i--) {
            const bit = (msgLen >>> i) & 1;
            const px = (bitIdx / 3) | 0;
            const ch = bitIdx % 3;
            const base = px * 4;
            result[base + ch] = (result[base + ch] & 0xFE) | bit;
            bitIdx++;
        }

        for (let b = 0; b < msgBytes.length; b++) {
            for (let i = 7; i >= 0; i--) {
                const bit = (msgBytes[b] >>> i) & 1;
                const px = (bitIdx / 3) | 0;
                const ch = bitIdx % 3;
                const base = px * 4;
                result[base + ch] = (result[base + ch] & 0xFE) | bit;
                bitIdx++;
            }
        }
        return result;
    }

    function decodeLsbJS(imgData, password) {
        const totalPixels = imgData.length / 4;

        if (totalPixels > MAX_IMAGE_PIXELS) {
            throw new Error('Image too large: maximum 4096x4096 pixels');
        }
        if (totalPixels < 11) {
            throw new Error('Image too small to contain hidden data');
        }

        let msgLen = 0;
        for (let i = 0; i < 32; i++) {
            msgLen = (msgLen << 1) | getBit(imgData, i);
        }

        if (msgLen === 0) return '';
        if (msgLen > MAX_MESSAGE_BYTES) {
            throw new Error('Invalid message length: exceeds maximum 1MB');
        }

        const totalBitsNeeded = 32 + msgLen * 8;
        const totalBitsAvailable = totalPixels * 3;
        if (totalBitsNeeded > totalBitsAvailable) {
            throw new Error('Corrupted or incomplete hidden data');
        }

        const msgBytes = new Uint8Array(msgLen);
        for (let i = 0; i < msgLen; i++) {
            const offset = 32 + i * 8;
            let byte = 0;
            for (let j = 0; j < 8; j++) {
                byte = (byte << 1) | getBit(imgData, offset + j);
            }
            msgBytes[i] = byte;
        }

        xorWithPassword(msgBytes, password);

        try {
            return new TextDecoder().decode(msgBytes);
        } catch (e) {
            throw new Error('Wrong password or corrupted data');
        }
    }

    function detectMemoryLimit() {
        try {
            if (performance && performance.memory) {
                const totalJSHeapSize = performance.memory.totalJSHeapSize;
                const usedJSHeapSize = performance.memory.usedJSHeapSize;
                const availableMB = (totalJSHeapSize - usedJSHeapSize) / (1024 * 1024);
                if (availableMB < 100) {
                    return { ok: false, reason: 'low_memory', availableMB };
                }
            }
            return { ok: true };
        } catch (e) {
            return { ok: true };
        }
    }

    async function loadWasm() {
        if (isMobile) {
            const memCheck = detectMemoryLimit();
            if (!memCheck.ok) {
                console.warn('Mobile memory too low, skipping WASM:', memCheck);
                useWasm = false;
                $('#wasmStatus').className = 'wasm-status fallback';
                $('#wasmStatus').textContent = '⚠️ 移动端内存不足，已使用 JS 实现';
                return;
            }
        }

        try {
            const module = await import('./pkg/lsb_stego.js');
            await module.default();
            wasmModule = module;
            useWasm = true;
            $('#wasmStatus').className = 'wasm-status loaded';
            $('#wasmStatus').textContent = '✅ WASM 模块加载成功 (Rust)' + (isMobile ? ' - 移动端' : '');
        } catch (e) {
            console.warn('WASM 加载失败，使用 JS 回退:', e);
            useWasm = false;
            $('#wasmStatus').className = 'wasm-status fallback';
            $('#wasmStatus').textContent = '⚠️ WASM 加载失败，已切换到 JS 纯实现: ' + e.message;
        }
    }

    function encode(imageDataArr, message, password) {
        if (useWasm && wasmModule) {
            try {
                const result = wasmModule.encode_lsb(imageDataArr, message, password);
                return result;
            } catch (e) {
                console.warn('WASM encode failed, falling back to JS:', e);
                useWasm = false;
                $('#wasmStatus').className = 'wasm-status fallback';
                $('#wasmStatus').textContent = '⚠️ WASM 加密失败，已切换到 JS 实现';
                return encodeLsbJS(imageDataArr, message, password);
            }
        }
        return encodeLsbJS(imageDataArr, message, password);
    }

    function decode(imageDataArr, password) {
        if (useWasm && wasmModule) {
            try {
                const result = wasmModule.decode_lsb(imageDataArr, password);
                return result;
            } catch (e) {
                console.warn('WASM decode failed, falling back to JS:', e);
                useWasm = false;
                $('#wasmStatus').className = 'wasm-status fallback';
                $('#wasmStatus').textContent = '⚠️ WASM 解密失败，已切换到 JS 实现';
                return decodeLsbJS(imageDataArr, password);
            }
        }
        return decodeLsbJS(imageDataArr, password);
    }

    function setStatus(msg, type) {
        const bar = $('#statusBar');
        bar.textContent = msg;
        bar.className = 'status-bar' + (type ? ' ' + type : '');
    }

    function updateButtonState() {
        const hasImage = loadedImage !== null;
        const hasText = $('#secretText').value.length > 0;
        $('#encodeBtn').disabled = !(hasImage && hasText);
        $('#decodeBtn').disabled = !hasImage;
    }

    async function validateWithBackend(file) {
        try {
            const formData = new FormData();
            formData.append('image', file);
            const resp = await fetch('/api/validate', { method: 'POST', body: formData });
            return await resp.json();
        } catch (e) {
            console.warn('后端校验不可用，跳过服务端验证:', e);
            return { valid: true, formats: [{ label: '未知（后端未连接）' }] };
        }
    }

    function compressImage(img, maxPixels) {
        const totalPixels = img.width * img.height;
        if (totalPixels <= maxPixels) {
            return { canvas: null, width: img.width, height: img.height };
        }

        const ratio = Math.sqrt(maxPixels / totalPixels);
        const newWidth = Math.floor(img.width * ratio);
        const newHeight = Math.floor(img.height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        return { canvas, width: newWidth, height: newHeight };
    }

    async function handleFile(file) {
        if (!file) return;

        setStatus('正在校验图片文件头...', '');
        const validation = await validateWithBackend(file);
        if (!validation.valid) {
            setStatus(validation.error, 'error');
            loadedImage = null;
            imageData = null;
            $('#previewArea').style.display = 'none';
            updateButtonState();
            return;
        }

        const formatInfo = validation.formats ? validation.formats.map(f => f.label).join('/') : '';
        setStatus('文件头校验通过: ' + formatInfo, 'success');

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const originalW = img.width;
                const originalH = img.height;
                const originalPixels = originalW * originalH;

                let targetW = originalW;
                let targetH = originalH;
                let compressed = false;
                let compressedImg = img;

                if (originalPixels > MAX_IMAGE_PIXELS) {
                    setStatus(`图片过大 (${originalW}×${originalH})，超过最大限制 4096×4096`, 'error');
                    loadedImage = null;
                    imageData = null;
                    $('#previewArea').style.display = 'none';
                    updateButtonState();
                    return;
                }

                if (originalPixels > COMPRESS_THRESHOLD_PX) {
                    setStatus('大图片检测中，正在自动压缩...', '');
                    const compressedResult = compressImage(img, TARGET_MAX_PX);
                    if (compressedResult.canvas) {
                        targetW = compressedResult.width;
                        targetH = compressedResult.height;
                        compressed = true;
                        const newImg = new Image();
                        newImg.src = compressedResult.canvas.toDataURL('image/png');
                        compressedImg = newImg;
                    }
                }

                const maxPixelsForDevice = isMobile ? 2048 * 2048 : MAX_IMAGE_PIXELS;
                if (targetW * targetH > maxPixelsForDevice && isMobile) {
                    const compressedResult = compressImage(compressedImg, maxPixelsForDevice);
                    if (compressedResult.canvas) {
                        targetW = compressedResult.width;
                        targetH = compressedResult.height;
                        compressed = true;
                        const newImg = new Image();
                        newImg.src = compressedResult.canvas.toDataURL('image/png');
                        compressedImg = newImg;
                    }
                }

                loadedImage = compressedImg;
                loadedImage.width = targetW;
                loadedImage.height = targetH;

                $('#previewImg').src = e.target.result;
                $('#previewArea').style.display = 'block';

                if (compressed) {
                    $('#fileName').textContent = `${file.name} (原始: ${originalW}×${originalH} → 压缩: ${targetW}×${targetH})`;
                } else {
                    $('#fileName').textContent = `${file.name} (${originalW}×${originalH})`;
                }

                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(compressedImg, 0, 0, targetW, targetH);

                imageData = ctx.getImageData(0, 0, targetW, targetH);

                updateButtonState();

                if (compressed) {
                    setStatus(`图片已自动压缩到 ${targetW}×${targetH} 以避免内存溢出`, 'success');
                } else {
                    setStatus('图片加载完成 (' + formatInfo + ')', 'success');
                }

                e.target.result = null;
                img.src = '';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        reader.onloadend = function () {
            reader.onload = null;
            reader.onerror = null;
        };
    }

    $('#fileInput').addEventListener('change', function (e) {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    const uploadZone = $('#uploadZone');
    uploadZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', function () {
        uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });

    $('#secretText').addEventListener('input', function () {
        const len = this.value.length;
        $('#charCount').textContent = len;
        if (len > MAX_MESSAGE_BYTES) {
            $('#charCount').style.color = '#f5576c';
        } else {
            $('#charCount').style.color = '#777';
        }
        updateButtonState();
    });

    document.querySelectorAll('.tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
            tab.classList.add('active');
            $('#' + tab.dataset.tab + 'Tab').classList.add('active');
        });
    });

    $('#encodeBtn').addEventListener('click', async function () {
        if (!imageData || !loadedImage) return;
        const message = $('#secretText').value;
        if (!message) return;

        if (message.length > MAX_MESSAGE_BYTES) {
            setStatus(`消息过长: ${message.length} 字节超过最大限制 ${MAX_MESSAGE_BYTES} 字节`, 'error');
            return;
        }

        const memCheck = detectMemoryLimit();
        if (!memCheck.ok) {
            setStatus(`内存不足 (可用 ${memCheck.availableMB.toFixed(0)}MB)，请关闭其他应用后重试`, 'error');
            return;
        }

        try {
            setStatus('正在加密...', '');

            const pixelCount = imageData.width * imageData.height;
            const neededPixels = Math.ceil((32 + message.length * 8) / 3);
            if (neededPixels > pixelCount) {
                setStatus(`图片容量不足: 需要 ${neededPixels} 像素，当前 ${pixelCount} 像素`, 'error');
                return;
            }

            let encoded;
            if (isMobile && imageData.data.length > 8 * 1024 * 1024) {
                setStatus('移动端处理大图片中，请稍候...', '');
                await new Promise(r => setTimeout(r, 50));
            }

            encoded = encode(imageData.data, message, $('#encodePassword').value);

            const canvas = $('#resultCanvas');
            canvas.width = loadedImage.width;
            canvas.height = loadedImage.height;
            const ctx = canvas.getContext('2d');
            const newImageData = ctx.createImageData(loadedImage.width, loadedImage.height);
            newImageData.data.set(new Uint8ClampedArray(encoded.buffer, encoded.byteOffset, encoded.byteLength));
            ctx.putImageData(newImageData, 0, 0);

            const dataUrl = canvas.toDataURL('image/png');
            $('#resultImg').src = dataUrl;
            $('#resultImgContainer').style.display = 'block';
            $('#decodedText').style.display = 'none';
            $('#downloadBtn').style.display = 'block';
            $('#resultTitle').textContent = '✅ 加密完成';
            $('#resultCard').classList.add('visible');

            setStatus('文本已成功隐藏到图片 LSB 中！', 'success');

            encoded = null;
            newImageData.data = null;
        } catch (e) {
            console.error('Encode error:', e);
            setStatus('加密失败: ' + e.message, 'error');
        }
    });

    $('#decodeBtn').addEventListener('click', async function () {
        if (!imageData || !loadedImage) return;

        const memCheck = detectMemoryLimit();
        if (!memCheck.ok) {
            setStatus(`内存不足 (可用 ${memCheck.availableMB.toFixed(0)}MB)，请关闭其他应用后重试`, 'error');
            return;
        }

        try {
            setStatus('正在解密...', '');

            if (isMobile && imageData.data.length > 8 * 1024 * 1024) {
                setStatus('移动端处理大图片中，请稍候...', '');
                await new Promise(r => setTimeout(r, 50));
            }

            const decoded = decode(imageData.data, $('#decodePassword').value);

            $('#resultImgContainer').style.display = 'none';
            $('#downloadBtn').style.display = 'none';
            $('#decodedText').style.display = 'block';
            $('#decodedText').textContent = decoded || '（未检测到隐藏信息）';
            $('#resultTitle').textContent = '🔓 解密结果';
            $('#resultCard').classList.add('visible');

            if (decoded) {
                setStatus('成功提取隐藏信息！', 'success');
            } else {
                setStatus('未找到隐藏信息', 'error');
            }
        } catch (e) {
            console.error('Decode error:', e);
            setStatus('解密失败: ' + e.message, 'error');
        }
    });

    $('#downloadBtn').addEventListener('click', function () {
        const canvas = $('#resultCanvas');
        canvas.toBlob(function (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = 'stego_image.png';
            link.href = url;
            link.click();
            setTimeout(function () {
                URL.revokeObjectURL(url);
                link.href = '';
            }, 1000);
        }, 'image/png');
    });

    window.addEventListener('unload', function () {
        if (imageData) {
            imageData.data = null;
        }
        loadedImage = null;
        imageData = null;
    });

    await loadWasm();
})();
