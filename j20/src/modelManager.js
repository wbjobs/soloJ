export const STYLES = [
    {
        id: 'mosaic',
        name: '马赛克',
        url: 'https://huggingface.co/onnx-models/fast-neural-style-mosaic/resolve/main/model.onnx',
        color: '#FF6B6B',
        preview: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <defs>
                    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#FF6B6B"/>
                        <stop offset="100%" style="stop-color:#4ECDC4"/>
                    </linearGradient>
                </defs>
                <rect fill="url(#g1)" width="200" height="200"/>
                <polygon points="0,0 100,50 200,0 150,100 200,200 100,150 0,200 50,100" fill="rgba(255,255,255,0.3)"/>
            </svg>
        `)
    },
    {
        id: 'candy',
        name: '糖果',
        url: 'https://huggingface.co/onnx-models/fast-neural-style-candy/resolve/main/model.onnx',
        color: '#FF8A80',
        preview: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <defs>
                    <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#FF8A80"/>
                        <stop offset="50%" style="stop-color:#FFD180"/>
                        <stop offset="100%" style="stop-color:#B388FF"/>
                    </linearGradient>
                </defs>
                <rect fill="url(#g2)" width="200" height="200"/>
                <circle cx="50" cy="50" r="30" fill="rgba(255,255,255,0.4)"/>
                <circle cx="150" cy="150" r="40" fill="rgba(255,255,255,0.3)"/>
            </svg>
        `)
    },
    {
        id: 'rain-princess',
        name: '雨公主',
        url: 'https://huggingface.co/onnx-models/fast-neural-style-rain-princess/resolve/main/model.onnx',
        color: '#5C6BC0',
        preview: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <defs>
                    <linearGradient id="g3" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#5C6BC0"/>
                        <stop offset="100%" style="stop-color:#283593"/>
                    </linearGradient>
                </defs>
                <rect fill="url(#g3)" width="200" height="200"/>
                <ellipse cx="100" cy="120" rx="60" ry="70" fill="rgba(255,255,255,0.2)"/>
                <circle cx="100" cy="70" r="35" fill="rgba(255,255,255,0.3)"/>
            </svg>
        `)
    },
    {
        id: 'udnie',
        name: '乌迪内',
        url: 'https://huggingface.co/onnx-models/fast-neural-style-udnie/resolve/main/model.onnx',
        color: '#7B1FA2',
        preview: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <defs>
                    <linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#7B1FA2"/>
                        <stop offset="100%" style="stop-color:#FFA726"/>
                    </linearGradient>
                </defs>
                <rect fill="url(#g4)" width="200" height="200"/>
                <path d="M0,100 Q50,20 100,100 T200,100" stroke="rgba(255,255,255,0.4)" stroke-width="20" fill="none"/>
                <path d="M0,150 Q50,70 100,150 T200,150" stroke="rgba(255,255,255,0.3)" stroke-width="15" fill="none"/>
            </svg>
        `)
    },
    {
        id: 'pointilism',
        name: '点彩画',
        url: 'https://huggingface.co/onnx-models/fast-neural-style-pointilism/resolve/main/model.onnx',
        color: '#26A69A',
        preview: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <rect fill="#26A69A" width="200" height="200"/>
                <circle cx="30" cy="30" r="8" fill="#FFD54F"/>
                <circle cx="70" cy="50" r="6" fill="#FF8A65"/>
                <circle cx="120" cy="30" r="10" fill="#81C784"/>
                <circle cx="170" cy="60" r="7" fill="#BA68C8"/>
                <circle cx="50" cy="100" r="9" fill="#4FC3F7"/>
                <circle cx="100" cy="120" r="11" fill="#FFD54F"/>
                <circle cx="150" cy="100" r="6" fill="#FF8A65"/>
                <circle cx="30" cy="160" r="8" fill="#81C784"/>
                <circle cx="80" cy="170" r="10" fill="#BA68C8"/>
                <circle cx="140" cy="150" r="7" fill="#4FC3F7"/>
                <circle cx="180" cy="170" r="9" fill="#FFD54F"/>
            </svg>
        `)
    },
    {
        id: 'the-scream',
        name: '呐喊',
        url: 'https://huggingface.co/onnx-models/fast-neural-style-the-scream/resolve/main/model.onnx',
        color: '#E65100',
        preview: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <defs>
                    <linearGradient id="g6" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#E65100"/>
                        <stop offset="50%" style="stop-color:#FFB300"/>
                        <stop offset="100%" style="stop-color:#4E342E"/>
                    </linearGradient>
                </defs>
                <rect fill="url(#g6)" width="200" height="200"/>
                <path d="M50,200 Q80,100 100,120 Q120,140 150,200" fill="rgba(0,0,0,0.5)"/>
                <ellipse cx="100" cy="80" rx="25" ry="35" fill="rgba(0,0,0,0.6)"/>
            </svg>
        `)
    },
    {
        id: 'la-muse',
        name: '缪斯',
        url: 'https://huggingface.co/onnx-models/fast-neural-style-la-muse/resolve/main/model.onnx',
        color: '#00838F',
        preview: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <defs>
                    <linearGradient id="g7" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#00838F"/>
                        <stop offset="100%" style="stop-color:#FF6F00"/>
                    </linearGradient>
                </defs>
                <rect fill="url(#g7)" width="200" height="200"/>
                <circle cx="100" cy="80" r="40" fill="rgba(255,255,255,0.3)"/>
                <ellipse cx="100" cy="180" rx="70" ry="30" fill="rgba(0,0,0,0.3)"/>
                <rect x="85" y="110" width="30" height="60" fill="rgba(255,255,255,0.2)"/>
            </svg>
        `)
    },
    {
        id: 'wave',
        name: '海浪',
        url: 'https://huggingface.co/onnx-models/fast-neural-style-wave/resolve/main/model.onnx',
        color: '#1565C0',
        preview: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <defs>
                    <linearGradient id="g8" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#1565C0"/>
                        <stop offset="100%" style="stop-color:#0D47A1"/>
                    </linearGradient>
                </defs>
                <rect fill="url(#g8)" width="200" height="200"/>
                <path d="M0,120 Q30,80 60,120 T120,120 T180,120 T200,120 L200,200 L0,200 Z" fill="rgba(255,255,255,0.3)"/>
                <path d="M0,150 Q30,110 60,150 T120,150 T180,150 T200,150 L200,200 L0,200 Z" fill="rgba(255,255,255,0.2)"/>
                <path d="M0,180 Q30,140 60,180 T120,180 T180,180 T200,180 L200,200 L0,200 Z" fill="rgba(255,255,255,0.1)"/>
            </svg>
        `)
    },
    {
        id: 'starry-night',
        name: '星夜',
        url: 'https://huggingface.co/onnx-models/fast-neural-style-starry-night/resolve/main/model.onnx',
        color: '#1A237E',
        preview: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <defs>
                    <linearGradient id="g9" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#0D47A1"/>
                        <stop offset="100%" style="stop-color:#1A237E"/>
                    </linearGradient>
                </defs>
                <rect fill="url(#g9)" width="200" height="200"/>
                <circle cx="30" cy="40" r="15" fill="#FFD54F" opacity="0.8"/>
                <circle cx="160" cy="60" r="10" fill="#FFF59D" opacity="0.7"/>
                <circle cx="80" cy="80" r="8" fill="#FFF9C4" opacity="0.6"/>
                <circle cx="130" cy="30" r="6" fill="#FFECB3" opacity="0.8"/>
                <circle cx="50" cy="120" r="5" fill="#FFF9C4" opacity="0.5"/>
                <ellipse cx="100" cy="180" rx="100" ry="30" fill="#2E7D32" opacity="0.6"/>
                <path d="M80,180 L90,140 L100,180 L110,150 L120,180" fill="#5D4037"/>
            </svg>
        `)
    },
    {
        id: 'the-great-wave',
        name: '神奈川冲浪里',
        url: 'https://huggingface.co/onnx-models/fast-neural-style-great-wave/resolve/main/model.onnx',
        color: '#006064',
        preview: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                <defs>
                    <linearGradient id="g10" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#006064"/>
                        <stop offset="50%" style="stop-color:#00838F"/>
                        <stop offset="100%" style="stop-color:#263238"/>
                    </linearGradient>
                </defs>
                <rect fill="url(#g10)" width="200" height="200"/>
                <circle cx="170" cy="50" r="25" fill="#FFD54F" opacity="0.9"/>
                <path d="M0,160 Q50,80 100,140 Q150,180 200,120 L200,200 L0,200 Z" fill="rgba(255,255,255,0.4)"/>
                <path d="M0,180 Q50,120 100,160 Q150,190 200,150 L200,200 L0,200 Z" fill="rgba(255,255,255,0.3)"/>
            </svg>
        `)
    }
];

export class ModelManager {
    constructor() {
        this.models = new Map();
        this.currentModel = null;
        this.currentStyleId = null;
        this.loadingPromises = new Map();
    }

    async loadModel(styleId, onProgress = null) {
        if (this.models.has(styleId)) {
            this.currentStyleId = styleId;
            this.currentModel = this.models.get(styleId);
            return this.currentModel;
        }

        if (this.loadingPromises.has(styleId)) {
            return this.loadingPromises.get(styleId);
        }

        const style = STYLES.find(s => s.id === styleId);
        if (!style) {
            throw new Error(`Style not found: ${styleId}`);
        }

        const loadPromise = this._loadModelWithProgress(style, onProgress);
        this.loadingPromises.set(styleId, loadPromise);

        try {
            const session = await loadPromise;
            this.models.set(styleId, session);
            this.currentStyleId = styleId;
            this.currentModel = session;
            return session;
        } finally {
            this.loadingPromises.delete(styleId);
        }
    }

    async _loadModelWithProgress(style, onProgress) {
        try {
            const session = await ort.InferenceSession.create(style.url, {
                executionProviders: ['webgl'],
                graphOptimizationLevel: 'all',
                enableCpuMemArena: true,
                enableMemPattern: true
            });
            return session;
        } catch (error) {
            console.warn(`WebGL not available for ${style.id}, falling back to WASM:`, error);
            const session = await ort.InferenceSession.create(style.url, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all',
                enableCpuMemArena: true,
                enableMemPattern: true
            });
            return session;
        }
    }

    getCurrentModel() {
        return this.currentModel;
    }

    getCurrentStyleId() {
        return this.currentStyleId;
    }

    isLoaded(styleId) {
        return this.models.has(styleId);
    }

    isLoading(styleId) {
        return this.loadingPromises.has(styleId);
    }

    getLoadedStyles() {
        return Array.from(this.models.keys());
    }

    releaseModel(styleId) {
        if (this.models.has(styleId)) {
            const model = this.models.get(styleId);
            if (model && typeof model.release === 'function') {
                model.release();
            }
            this.models.delete(styleId);
            if (this.currentStyleId === styleId) {
                this.currentModel = null;
                this.currentStyleId = null;
            }
        }
    }

    releaseAll() {
        for (const styleId of this.models.keys()) {
            this.releaseModel(styleId);
        }
    }

    preloadAll(onProgress = null) {
        return Promise.all(
            STYLES.map(style => 
                this.loadModel(style.id, onProgress).catch(err => {
                    console.error(`Failed to preload ${style.id}:`, err);
                    return null;
                })
            )
        );
    }
}
