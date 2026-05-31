const VERTEX_SHADER = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;

const FRAGMENT_SHADER = `
    precision highp float;
    
    varying vec2 v_texCoord;
    
    uniform sampler2D u_originalTexture;
    uniform sampler2D u_styledTexture;
    uniform sampler2D u_maskTexture;
    uniform sampler2D u_semanticMaskTexture;
    uniform float u_intensity;
    uniform float u_semanticIntensity;
    uniform bool u_useMask;
    uniform bool u_useSemanticMask;
    
    void main() {
        vec2 uv = v_texCoord;
        uv.y = 1.0 - uv.y;
        
        vec4 originalColor = texture2D(u_originalTexture, uv);
        vec4 styledColor = texture2D(u_styledTexture, uv);
        
        vec4 finalColor = mix(originalColor, styledColor, u_intensity);
        
        if (u_useSemanticMask) {
            vec4 semanticMaskColor = texture2D(u_semanticMaskTexture, uv);
            float semanticMaskValue = semanticMaskColor.r;
            float adjustedIntensity = mix(u_intensity, 1.0, semanticMaskValue);
            finalColor = mix(originalColor, styledColor, adjustedIntensity);
        }
        
        if (u_useMask && !u_useSemanticMask) {
            vec4 maskColor = texture2D(u_maskTexture, uv);
            float maskValue = maskColor.r;
            finalColor = mix(originalColor, finalColor, maskValue);
        } else if (u_useMask && u_useSemanticMask) {
            vec4 maskColor = texture2D(u_maskTexture, uv);
            float maskValue = maskColor.r;
            vec4 faceProtectedColor = mix(originalColor, finalColor, maskValue);
            
            vec4 semanticMaskColor = texture2D(u_semanticMaskTexture, uv);
            float semanticMaskValue = semanticMaskColor.r;
            finalColor = mix(faceProtectedColor, styledColor, semanticMaskValue * (1.0 - maskValue));
        }
        
        gl_FragColor = finalColor;
    }
`;

export class StyleProcessor {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.textures = {};
        this.buffers = {};
        this.locations = {};
        this.intensity = 1.0;
        this.semanticIntensity = 1.0;
        this.useMask = true;
        this.useSemanticMask = false;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;

        this.gl = this.canvas.getContext('webgl', {
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            antialias: false
        });

        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        this._createProgram();
        this._createBuffers();
        this._createTextures();
        this._getUniformLocations();

        this.isInitialized = true;
    }

    _createProgram() {
        const gl = this.gl;
        
        const vertexShader = this._compileShader(VERTEX_SHADER, gl.VERTEX_SHADER);
        const fragmentShader = this._compileShader(FRAGMENT_SHADER, gl.FRAGMENT_SHADER);
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + gl.getProgramInfoLog(this.program));
        }
        
        gl.useProgram(this.program);
    }

    _compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader));
        }
        
        return shader;
    }

    _createBuffers() {
        const gl = this.gl;
        
        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);
        
        const texCoords = new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            1, 1
        ]);
        
        this.buffers.position = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        
        this.buffers.texCoord = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.texCoord);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        
        const positionLoc = gl.getAttribLocation(this.program, 'a_position');
        const texCoordLoc = gl.getAttribLocation(this.program, 'a_texCoord');
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.texCoord);
        gl.enableVertexAttribArray(texCoordLoc);
        gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);
    }

    _createTextures() {
        const gl = this.gl;
        
        this.textures.original = this._createTexture();
        this.textures.styled = this._createTexture();
        this.textures.mask = this._createTexture();
        this.textures.semanticMask = this._createTexture();
    }

    _createTexture() {
        const gl = this.gl;
        const texture = gl.createTexture();
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        return texture;
    }

    _getUniformLocations() {
        const gl = this.gl;
        
        this.locations.originalTexture = gl.getUniformLocation(this.program, 'u_originalTexture');
        this.locations.styledTexture = gl.getUniformLocation(this.program, 'u_styledTexture');
        this.locations.maskTexture = gl.getUniformLocation(this.program, 'u_maskTexture');
        this.locations.semanticMaskTexture = gl.getUniformLocation(this.program, 'u_semanticMaskTexture');
        this.locations.intensity = gl.getUniformLocation(this.program, 'u_intensity');
        this.locations.semanticIntensity = gl.getUniformLocation(this.program, 'u_semanticIntensity');
        this.locations.useMask = gl.getUniformLocation(this.program, 'u_useMask');
        this.locations.useSemanticMask = gl.getUniformLocation(this.program, 'u_useSemanticMask');
    }

    setSize(width, height) {
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.gl.viewport(0, 0, width, height);
        }
    }

    setIntensity(intensity) {
        this.intensity = Math.max(0, Math.min(1, intensity));
    }

    setUseMask(useMask) {
        this.useMask = useMask;
    }

    setUseSemanticMask(useSemanticMask) {
        this.useSemanticMask = useSemanticMask;
    }

    setSemanticIntensity(intensity) {
        this.semanticIntensity = Math.max(0, Math.min(1, intensity));
    }

    uploadImageElement(textureName, element) {
        const gl = this.gl;
        const texture = this.textures[textureName];
        
        if (!texture) return;
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, element);
    }

    uploadImageData(textureName, imageData) {
        const gl = this.gl;
        const texture = this.textures[textureName];
        
        if (!texture) return;
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, imageData.width, imageData.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);
    }

    render() {
        const gl = this.gl;
        
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures.original);
        gl.uniform1i(this.locations.originalTexture, 0);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.textures.styled);
        gl.uniform1i(this.locations.styledTexture, 1);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.textures.mask);
        gl.uniform1i(this.locations.maskTexture, 2);
        
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.textures.semanticMask);
        gl.uniform1i(this.locations.semanticMaskTexture, 3);
        
        gl.uniform1f(this.locations.intensity, this.intensity);
        gl.uniform1f(this.locations.semanticIntensity, this.semanticIntensity);
        gl.uniform1i(this.locations.useMask, this.useMask ? 1 : 0);
        gl.uniform1i(this.locations.useSemanticMask, this.useSemanticMask ? 1 : 0);
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    process(originalElement, styledElement, maskCanvas, semanticMaskCanvas = null) {
        if (!this.isInitialized) {
            this.init();
        }
        
        const width = originalElement.videoWidth || originalElement.width;
        const height = originalElement.videoHeight || originalElement.height;
        
        this.setSize(width, height);
        
        this.uploadImageElement('original', originalElement);
        this.uploadImageElement('styled', styledElement);
        
        if (maskCanvas && this.useMask) {
            this.uploadImageElement('mask', maskCanvas);
        }
        
        if (semanticMaskCanvas && this.useSemanticMask) {
            this.uploadImageElement('semanticMask', semanticMaskCanvas);
        }
        
        this.render();
    }

    readPixels() {
        const gl = this.gl;
        const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
        gl.readPixels(0, 0, this.canvas.width, this.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
    }

    dispose() {
        const gl = this.gl;
        
        if (this.program) {
            gl.deleteProgram(this.program);
        }
        
        Object.values(this.buffers).forEach(buffer => gl.deleteBuffer(buffer));
        Object.values(this.textures).forEach(texture => gl.deleteTexture(texture));
        
        this.isInitialized = false;
    }
}
