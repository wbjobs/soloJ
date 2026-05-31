class CompareRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!this.gl) throw new Error('WebGL not supported');

        this.maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
        this.opacity = 0.5;
        this.colormap = 'inferno';
        this.data1 = null;
        this.data2 = null;
        this.width = 0;
        this.height = 0;

        this.initShaders();
        this.initBuffers();
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
            uniform sampler2D u_texture1;
            uniform sampler2D u_texture2;
            uniform float u_opacity;
            uniform int u_colormap;

            vec3 cm_inferno(float t) {
                t = clamp(t, 0.0, 1.0);
                return vec3(0.00021894, 0.00165100, -0.01948089) + t*(vec3(0.10651030, 0.58227688, 3.93573055) + t*(vec3(11.52821759, -3.96678301, -15.94239411) + t*(vec3(-41.12468896, 16.35374853, 44.43557063) + t*(vec3(77.69859250, -32.89031883, -81.52053664) + t*(vec3(-71.74087360, 33.75121387, 73.50565646) + t*vec3(26.58558110, -13.20687070, -26.28172397))))));
            }

            vec3 cm_viridis(float t) {
                t = clamp(t, 0.0, 1.0);
                return vec3(0.27772733, 0.00540734, 0.33409980) + t*(vec3(0.10651030, 0.58227688, 0.68848617) + t*(vec3(0.11559992, -0.14195618, 0.13235997) + t*(vec3(-0.79421336, 0.25315030, 0.08499218) + t*vec3(2.81463531, -0.58440966, -0.23418611))));
            }

            vec3 cm_hot(float t) {
                t = clamp(t, 0.0, 1.0);
                return vec3(smoothstep(0.0, 0.33, t), smoothstep(0.33, 0.66, t), smoothstep(0.66, 1.0, t));
            }

            vec3 applyCmap(float t) {
                if (u_colormap == 1) return cm_viridis(t);
                else if (u_colormap == 2) return cm_hot(t);
                else if (u_colormap == 3) return vec3(t);
                return cm_inferno(t);
            }

            void main() {
                float v1 = texture2D(u_texture1, v_texCoord).r;
                float v2 = texture2D(u_texture2, v_texCoord).r;
                vec3 c1 = applyCmap(v1);
                vec3 c2 = applyCmap(v2);
                vec3 blended = mix(c1, c2, u_opacity);
                gl_FragColor = vec4(blended, 1.0);
            }
        `;

        const vs = this.compile(gl.VERTEX_SHADER, vsSource);
        const fs = this.compile(gl.FRAGMENT_SHADER, fsSource);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('Program link error');
        }

        gl.useProgram(this.program);
        this.positionLoc = gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLoc = gl.getAttribLocation(this.program, 'a_texCoord');
        this.texture1Loc = gl.getUniformLocation(this.program, 'u_texture1');
        this.texture2Loc = gl.getUniformLocation(this.program, 'u_texture2');
        this.opacityLoc = gl.getUniformLocation(this.program, 'u_opacity');
        this.colormapLoc = gl.getUniformLocation(this.program, 'u_colormap');
    }

    compile(type, src) {
        const gl = this.gl;
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    }

    initBuffers() {
        const gl = this.gl;
        const pos = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
        const tex = new Float32Array([0,1, 1,1, 0,0, 1,0]);

        this.posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);

        this.texBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuf);
        gl.bufferData(gl.ARRAY_BUFFER, tex, gl.STATIC_DRAW);

        this.tex1 = gl.createTexture();
        this.tex2 = gl.createTexture();
    }

    setData(data1, data2, width, height) {
        this.data1 = data1;
        this.data2 = data2;
        this.width = width;
        this.height = height;

        let tw = width, th = height;
        let d1 = data1, d2 = data2;

        if (width > this.maxTextureSize || height > this.maxTextureSize) {
            const ratio = Math.max(Math.ceil(width / this.maxTextureSize), Math.ceil(height / this.maxTextureSize));
            tw = Math.min(Math.ceil(width / ratio), this.maxTextureSize);
            th = Math.min(Math.ceil(height / ratio), this.maxTextureSize);
            d1 = this.downsample(data1, width, height, tw, th);
            d2 = this.downsample(data2, width, height, tw, th);
        }

        this.canvas.width = tw;
        this.canvas.height = th;
        this.gl.viewport(0, 0, tw, th);

        this.uploadTexture(this.tex1, d1, tw, th);
        this.uploadTexture(this.tex2, d2, tw, th);
        this.render();
    }

    downsample(data, ow, oh, tw, th) {
        const ratio = ow / tw;
        const result = [];
        for (let ty = 0; ty < th; ty++) {
            const row = [];
            const y0 = Math.floor(ty * ratio), y1 = Math.min(Math.floor((ty+1)*ratio), oh);
            for (let tx = 0; tx < tw; tx++) {
                const x0 = Math.floor(tx * ratio), x1 = Math.min(Math.floor((tx+1)*ratio), ow);
                let sum = 0, cnt = 0;
                for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
                    const v = data[y][x];
                    if (isFinite(v)) { sum += v; cnt++; }
                }
                row.push(cnt > 0 ? sum/cnt : 0);
            }
            result.push(row);
        }
        return result;
    }

    uploadTexture(tex, data, w, h) {
        const gl = this.gl;
        const pixels = new Float32Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pixels[y*w+x] = data[y][x];

        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.FLOAT, pixels);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    setOpacity(val) { this.opacity = parseFloat(val); this.render(); }
    setColormap(name) { this.colormap = name; this.render(); }

    getColormapIdx() {
        const m = { inferno:0, viridis:1, hot:2, grayscale:3 };
        return m[this.colormap] || 0;
    }

    render() {
        const gl = this.gl;
        gl.clearColor(0,0,0,1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
        gl.enableVertexAttribArray(this.positionLoc);
        gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuf);
        gl.enableVertexAttribArray(this.texCoordLoc);
        gl.vertexAttribPointer(this.texCoordLoc, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex1);
        gl.uniform1i(this.texture1Loc, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.tex2);
        gl.uniform1i(this.texture2Loc, 1);

        gl.uniform1f(this.opacityLoc, this.opacity);
        gl.uniform1i(this.colormapLoc, this.getColormapIdx());

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
