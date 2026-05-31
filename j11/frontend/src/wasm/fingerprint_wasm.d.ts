declare module '*.wasm' {
    const content: string;
    export default content;
}

interface FingerprintEngineOptions {
    sampleRate?: number;
    frameSize?: number;
    hopSize?: number;
}

interface Peak {
    frame: number;
    bin: number;
    magnitude: number;
}

interface FingerprintData {
    hash: number;
    offset: number;
}

interface FingerprintEngineInstance {
    extractPeaks(signal: Float32Array): Peak[];
    generateFingerprints(signal: Float32Array): FingerprintData[];
    generateFingerprintArray(signal: Float32Array): number[];
    getFrameSize(): number;
    getHopSize(): number;
    getSampleRate(): number;
    destroy(): void;
    getDynamicMemoryUsed(): number;
    isDestroyed?: boolean;
}

interface WasmModule {
    FingerprintEngine: new (
        sampleRate: number,
        frameSize: number,
        hopSize: number
    ) => FingerprintEngineInstance;
    HEAP8: Uint8Array;
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    allocate: (data: any, types: any, flags: any) => number;
    UTF8ToString: (ptr: number) => string;
    stringToUTF8: (str: string, ptr: number, maxBytes: number) => void;
    lengthBytesUTF8: (str: string) => number;
    addFunction: (func: Function, signature: string) => number;
    removeFunction: (funcPtr: number) => void;
}

export async function loadFingerprintModule(): Promise<WasmModule>;

export function createFingerprintEngine(
    options?: FingerprintEngineOptions
): Promise<FingerprintEngineInstance>;

export function destroyFingerprintEngine(engine: FingerprintEngineInstance): void;

export function getWasmMemoryUsage(): {
    used: number;
    total: number;
    megabytes: number;
};

export function trackMemoryUsage(): {
    start: () => void;
    stop: () => void;
    getSnapshot: () => number[];
};
