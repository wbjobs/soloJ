import createFingerprintModule from './audio_fingerprint.js';

export interface Peak {
    frame: number;
    bin: number;
    magnitude: number;
}

export interface FingerprintData {
    hash: number;
    offset: number;
}

export interface FingerprintEngineOptions {
    sampleRate?: number;
    frameSize?: number;
    hopSize?: number;
}

export interface FingerprintEngine {
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
    ) => FingerprintEngine;
    HEAP8: Uint8Array;
}

let wasmModule: WasmModule | null = null;
let activeEngines: Set<FingerprintEngine> = new Set();

export async function loadWasmModule(): Promise<WasmModule> {
    if (wasmModule) return wasmModule;
    wasmModule = await createFingerprintModule();
    return wasmModule;
}

export async function createFingerprintEngine(
    options: FingerprintEngineOptions = {}
): Promise<FingerprintEngine> {
    const Module = await loadWasmModule();
    const sampleRate = options.sampleRate ?? 44100;
    const frameSize = options.frameSize ?? 4096;
    const hopSize = options.hopSize ?? 1024;

    const engine: FingerprintEngine = new Module.FingerprintEngine(
        sampleRate,
        frameSize,
        hopSize
    );

    const originalDestroy = engine.destroy.bind(engine);
    engine.destroy = () => {
        if (!engine.isDestroyed) {
            originalDestroy();
            engine.isDestroyed = true;
            activeEngines.delete(engine);
        }
    };

    activeEngines.add(engine);
    return engine;
}

export function destroyFingerprintEngine(engine: FingerprintEngine): void {
    if (!engine || engine.isDestroyed) return;
    engine.destroy();
}

export function getActiveEngineCount(): number {
    return activeEngines.size;
}

export function getWasmMemoryUsage(): {
    used: number;
    total: number;
    megabytes: number;
} {
    if (!wasmModule) {
        return { used: 0, total: 0, megabytes: 0 };
    }
    const total = wasmModule.HEAP8.buffer.byteLength;
    const used = total;
    return {
        used,
        total,
        megabytes: total / (1024 * 1024),
    };
}

export function destroyAllEngines(): void {
    for (const engine of Array.from(activeEngines)) {
        try {
            destroyFingerprintEngine(engine);
        } catch (e) {
            console.warn('Error destroying engine:', e);
        }
    }
    activeEngines.clear();
}

if (typeof window !== 'undefined') {
    (window as any).destroyAllWasmEngines = destroyAllEngines;
    (window as any).getWasmMemoryStats = () => ({
        activeEngines: getActiveEngineCount(),
        memory: getWasmMemoryUsage(),
    });
}
