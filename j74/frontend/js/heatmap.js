class HeatmapRenderer {
    constructor(canvasId, colorbarId, pixelInfoId) {
        this.canvas = document.getElementById(canvasId);
        this.colorbar = document.getElementById(colorbarId);
        this.pixelInfo = document.getElementById(pixelInfoId);
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        this.width = 0;
        this.height = 0;
        this.originalData = null;
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.minVal = 0;
        this.maxVal = 1;
        this.contrast = 1.0;
        this.brightness = 0.0;
        this.colormap = 'inferno';
        this.downscaleRatio = 1;

        this.maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
        console.log('[HeatmapRenderer] WebGL MAX_TEXTURE_SIZE = ' + this.maxTextureSize);

        this.initShaders();
        this.initBuffers();
        this.initEventListeners();
    }

    initShaders() {
        const gl = this.gl;

        const vsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        const fsSource = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            uniform float u_contrast;
            uniform float u_brightness;
            uniform int u_colormap;

            vec3 colormap_inferno(float t) {
                t = clamp(t, 0.0, 1.0);
                vec3 a = vec3(0.00021894, 0.00165100, -0.01948089);
                vec3 b = vec3(0.10651030, 0.58227688, 3.93573055);
                vec3 c = vec3(11.52821759, -3.96678301, -15.94239411);
                vec3 d = vec3(-41.12468896, 16.35374853, 44.43557063);
                vec3 e = vec3(77.69859250, -32.89031883, -81.52053664);
                vec3 f = vec3(-71.74087360, 33.75121387, 73.50565646);
                vec3 g = vec3(26.58558110, -13.20687070, -26.28172397);
                return a + t*(b + t*(c + t*(d + t*(e + t*(f + t*g)))));
            }

            vec3 colormap_viridis(float t) {
                t = clamp(t, 0.0, 1.0);
                vec3 a = vec3(0.27772733, 0.00540734, 0.33409980);
                vec3 b = vec3(0.10651030, 0.58227688, 0.68848617);
                vec3 c = vec3(0.11559992, -0.14195618, 0.13235997);
                vec3 d = vec3(-0.79421336, 0.25315030, 0.08499218);
                vec3 e = vec3(2.81463531, -0.58440966, -0.23418611);
                return a + t*(b + t*(c + t*(d + t*e)));
            }

            vec3 colormap_plasma(float t) {
                t = clamp(t, 0.0, 1.0);
                vec3 a = vec3(0.05873234, 0.02333720, 0.54333972);
                vec3 b = vec3(2.17651464, 0.23838343, 0.35536552);
                vec3 c = vec3(-2.68946048, 2.64001724, -0.56294160);
                vec3 d = vec3(0.63781543, -0.90635416, 0.66464918);
                return a + t*(b + t*(c + t*d));
            }

            vec3 colormap_magma(float t) {
                t = clamp(t, 0.0, 1.0);
                vec3 a = vec3(-0.00096222, -0.00069160, 0.02449849);
                vec3 b = vec3(0.48906525, 0.46822246, 0.63233960);
                vec3 c = vec3(1.05172151, 0.10961616, 0.49468104);
                vec3 d = vec3(1.20516703, 1.41536953, -1.39952511);
                return a + t*(b + t*(c + t*d));
            }

            vec3 colormap_hot(float t) {
                t = clamp(t, 0.0, 1.0);
                float r = smoothstep(0.0, 0.33, t);
                float g = smoothstep(0.33, 0.66, t);
                float b = smoothstep(0.66, 1.0, t);
                return vec3(r, g, b);
            }

            void main() {
                float value = texture2D(u_texture, v_texCoord).r;
                
                value = (value - 0.5) * u_contrast + 0.5 + u_brightness;
                value = clamp(value, 0.0, 1.0);
                
                vec3 color;
                if (u_colormap == 1) {
                    color = colormap_viridis(value);
                } else if (u_colormap == 2) {
                    color = colormap_plasma(value);
                } else if (u_colormap == 3) {
                    color = colormap_magma(value);
                } else if (u_colormap == 4) {
                    color = colormap_hot(value);
                } else if (u_colormap == 5) {
                    color = vec3(value);
                } else {
                    color = colormap_inferno(value);
                }
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;

        const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + gl.getProgramInfoLog(this.program));
        }

        gl.useProgram(this.program);

        this.positionLoc = gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLoc = gl.getAttribLocation(this.program, 'a_texCoord');
        this.textureLoc = gl.getUniformLocation(this.program, 'u_texture');
        this.contrastLoc = gl.getUniformLocation(this.program, 'u_contrast');
        this.brightnessLoc = gl.getUniformLocation(this.program, 'u_brightness');
        this.colormapLoc = gl.getUniformLocation(this.program, 'u_colormap');
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    initBuffers() {
        const gl = this.gl;

        const positions = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1
        ]);

        const texCoords = new Float32Array([
            0, 1,
            1, 1,
            0, 0,
            1, 0
        ]);

        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        this.texture = gl.createTexture();
    }

    initEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.originalData) return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.originalWidth / rect.width;
            const scaleY = this.originalHeight / rect.height;
            const origX = Math.floor((e.clientX - rect.left) * scaleX);
            const origY = Math.floor((e.clientY - rect.top) * scaleY);
            
            if (origX >= 0 && origX < this.originalWidth && origY >= 0 && origY < this.originalHeight) {
                const normVal = this.originalData[origY][origX];
                const realVal = normVal * (this.maxVal - this.minVal) + this.minVal;
                this.pixelInfo.textContent = `位置: (${origX}, ${origY}) | 归一化: ${normVal.toFixed(4)} | 原值: ${realVal.toFixed(4)}` +
                    (this.downscaleRatio > 1 ? ` | 缩放: 1/${this.downscaleRatio}` : '');
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.pixelInfo.textContent = '移动鼠标查看像素信息';
        });
    }

    downsampleData(data, origWidth, origHeight, targetWidth, targetHeight) {
        const ratio = origWidth / targetWidth;
        const result = [];
        for (let ty = 0; ty < targetHeight; ty++) {
            const row = [];
            const srcY0 = Math.floor(ty * ratio);
            const srcY1 = Math.min(Math.floor((ty + 1) * ratio), origHeight);
            for (let tx = 0; tx < targetWidth; tx++) {
                const srcX0 = Math.floor(tx * ratio);
                const srcX1 = Math.min(Math.floor((tx + 1) * ratio), origWidth);
                let sum = 0;
                let count = 0;
                for (let sy = srcY0; sy < srcY1; sy++) {
                    for (let sx = srcX0; sx < srcX1; sx++) {
                        const v = data[sy][sx];
                        if (isFinite(v)) {
                            sum += v;
                            count++;
                        }
                    }
                }
                row.push(count > 0 ? sum / count : 0);
            }
            result.push(row);
        }
        return result;
    }

    setData(data, width, height, minVal, maxVal) {
        this.originalData = data;
        this.originalWidth = width;
        this.originalHeight = height;
        this.minVal = minVal;
        this.maxVal = maxVal;

        let textureWidth = width;
        let textureHeight = height;
        let textureData = data;
        this.downscaleRatio = 1;

        if (width > this.maxTextureSize || height > this.maxTextureSize) {
            const ratio = Math.max(
                Math.ceil(width / this.maxTextureSize),
                Math.ceil(height / this.maxTextureSize)
            );
            this.downscaleRatio = ratio;
            textureWidth = Math.ceil(width / ratio);
            textureHeight = Math.ceil(height / ratio);

            textureWidth = Math.min(textureWidth, this.maxTextureSize);
            textureHeight = Math.min(textureHeight, this.maxTextureSize);

            console.log(`[HeatmapRenderer] 降采样: ${width}x${height} -> ${textureWidth}x${textureHeight} (ratio=1/${ratio})`);

            textureData = this.downsampleData(data, width, height, textureWidth, textureHeight);
        }

        this.width = textureWidth;
        this.height = textureHeight;

        this.canvas.width = textureWidth;
        this.canvas.height = textureHeight;

        const gl = this.gl;
        gl.viewport(0, 0, textureWidth, textureHeight);

        const pixels = new Float32Array(textureWidth * textureHeight);
        for (let y = 0; y < textureHeight; y++) {
            for (let x = 0; x < textureWidth; x++) {
                pixels[y * textureWidth + x] = textureData[y][x];
            }
        }

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, textureWidth, textureHeight, 0, gl.LUMINANCE, gl.FLOAT, pixels);

        var texError = gl.getError();
        if (texError !== gl.NO_ERROR) {
            console.error('[HeatmapRenderer] texImage2D error: ' + texError);
        }

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        this.render();
        this.updateColorbar();
    }

    setContrast(value) {
        this.contrast = parseFloat(value);
        this.render();
    }

    setBrightness(value) {
        this.brightness = parseFloat(value);
        this.render();
    }

    setColormap(name) {
        this.colormap = name;
        this.render();
        this.updateColorbar();
    }

    getColormapIndex(name) {
        const maps = { inferno: 0, viridis: 1, plasma: 2, magma: 3, hot: 4, grayscale: 5 };
        return maps[name] || 0;
    }

    render() {
        const gl = this.gl;

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.positionLoc);
        gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(this.texCoordLoc);
        gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.textureLoc, 0);

        gl.uniform1f(this.contrastLoc, this.contrast);
        gl.uniform1f(this.brightnessLoc, this.brightness);
        gl.uniform1i(this.colormapLoc, this.getColormapIndex(this.colormap));

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    updateColorbar() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(256, 1);

        const colormapFunc = this.getColormapRGB.bind(this);

        for (let i = 0; i < 256; i++) {
            const t = i / 255;
            const rgb = colormapFunc(t);
            imgData.data[i * 4] = Math.floor(rgb[0] * 255);
            imgData.data[i * 4 + 1] = Math.floor(rgb[1] * 255);
            imgData.data[i * 4 + 2] = Math.floor(rgb[2] * 255);
            imgData.data[i * 4 + 3] = 255;
        }

        ctx.putImageData(imgData, 0, 0);
        this.colorbar.style.backgroundImage = `url(${canvas.toDataURL()})`;
        this.colorbar.style.backgroundSize = '100% 100%';
    }

    getColormapRGB(t) {
        t = Math.max(0, Math.min(1, t));
        switch (this.colormap) {
            case 'inferno':
                return this.inferno(t);
            case 'viridis':
                return this.viridis(t);
            case 'plasma':
                return this.plasma(t);
            case 'magma':
                return this.magma(t);
            case 'hot':
                return [Math.min(1, t/0.33), Math.max(0, Math.min(1, (t-0.33)/0.33)), Math.max(0, (t-0.66)/0.34)];
            case 'grayscale':
                return [t, t, t];
            default:
                return this.inferno(t);
        }
    }

    inferno(t) {
        const a = [0.00021894, 0.00165100, -0.01948089];
        const b = [0.10651030, 0.58227688, 3.93573055];
        const c = [11.52821759, -3.96678301, -15.94239411];
        const d = [-41.12468896, 16.35374853, 44.43557063];
        const e = [77.69859250, -32.89031883, -81.52053664];
        const f = [-71.74087360, 33.75121387, 73.50565646];
        const g = [26.58558110, -13.20687070, -26.28172397];
        return [
            a[0] + t*(b[0] + t*(c[0] + t*(d[0] + t*(e[0] + t*(f[0] + t*g[0]))))),
            a[1] + t*(b[1] + t*(c[1] + t*(d[1] + t*(e[1] + t*(f[1] + t*g[1]))))),
            a[2] + t*(b[2] + t*(c[2] + t*(d[2] + t*(e[2] + t*(f[2] + t*g[2])))))
        ];
    }

    viridis(t) {
        const a = [0.27772733, 0.00540734, 0.33409980];
        const b = [0.10651030, 0.58227688, 0.68848617];
        const c = [0.11559992, -0.14195618, 0.13235997];
        const d = [-0.79421336, 0.25315030, 0.08499218];
        const e = [2.81463531, -0.58440966, -0.23418611];
        return [
            a[0] + t*(b[0] + t*(c[0] + t*(d[0] + t*e[0]))),
            a[1] + t*(b[1] + t*(c[1] + t*(d[1] + t*e[1]))),
            a[2] + t*(b[2] + t*(c[2] + t*(d[2] + t*e[2])))
        ];
    }

    plasma(t) {
        const a = [0.05873234, 0.02333720, 0.54333972];
        const b = [2.17651464, 0.23838343, 0.35536552];
        const c = [-2.68946048, 2.64001724, -0.56294160];
        const d = [0.63781543, -0.90635416, 0.66464918];
        return [
            a[0] + t*(b[0] + t*(c[0] + t*d[0])),
            a[1] + t*(b[1] + t*(c[1] + t*d[1])),
            a[2] + t*(b[2] + t*(c[2] + t*d[2]))
        ];
    }

    magma(t) {
        const a = [-0.00096222, -0.00069160, 0.02449849];
        const b = [0.48906525, 0.46822246, 0.63233960];
        const c = [1.05172151, 0.10961616, 0.49468104];
        const d = [1.20516703, 1.41536953, -1.39952511];
        return [
            a[0] + t*(b[0] + t*(c[0] + t*d[0])),
            a[1] + t*(b[1] + t*(c[1] + t*d[1])),
            a[2] + t*(b[2] + t*(c[2] + t*d[2]))
        ];
    }
}
