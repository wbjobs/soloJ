import { useState, useRef, useCallback, useEffect } from 'react';
import {
    createFingerprintEngine,
    destroyFingerprintEngine,
    FingerprintEngine,
    FingerprintData,
    Peak,
    getWasmMemoryUsage,
} from '../wasm/fingerprint_wasm';

export interface FingerprintState {
    isLoaded: boolean;
    isProcessing: boolean;
    peaks: Peak[];
    fingerprints: FingerprintData[];
    error: string | null;
    memoryUsage: {
        used: number;
        total: number;
        megabytes: number;
    };
}

export interface FingerprintAPI {
    engine: FingerprintEngine | null;
    state: FingerprintState;
    processSignal: (signal: Float32Array) => Promise<FingerprintData[]>;
    extractPeaks: (signal: Float32Array) => Promise<Peak[]>;
    destroy: () => void;
}

export function useFingerprint(): FingerprintAPI {
    const [state, setState] = useState<FingerprintState>({
        isLoaded: false,
        isProcessing: false,
        peaks: [],
        fingerprints: [],
        error: null,
        memoryUsage: { used: 0, total: 0, megabytes: 0 },
    });

    const engineRef = useRef<FingerprintEngine | null>(null);
    const isDestroyedRef = useRef(false);

    const destroy = useCallback(() => {
        if (engineRef.current) {
            destroyFingerprintEngine(engineRef.current);
            engineRef.current = null;
        }
        isDestroyedRef.current = true;
    }, []);

    useEffect(() => {
        let cancelled = false;

        createFingerprintEngine({
            sampleRate: 44100,
            frameSize: 4096,
            hopSize: 1024,
        })
            .then(engine => {
                if (!cancelled && !isDestroyedRef.current) {
                    engineRef.current = engine;
                    const mem = getWasmMemoryUsage();
                    setState(s => ({ ...s, isLoaded: true, memoryUsage: mem }));
                } else {
                    destroyFingerprintEngine(engine);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setState(s => ({ ...s, error: err.message }));
                }
            });

        return () => {
            cancelled = true;
            destroy();
        };
    }, [destroy]);

    const processSignal = useCallback(
        async (signal: Float32Array): Promise<FingerprintData[]> => {
            if (!engineRef.current || engineRef.current.isDestroyed) {
                throw new Error('WASM engine not loaded or already destroyed');
            }
            setState(s => ({ ...s, isProcessing: true }));
            try {
                const fps = engineRef.current.generateFingerprints(signal);
                const mem = getWasmMemoryUsage();
                setState(s => ({
                    ...s,
                    fingerprints: fps,
                    isProcessing: false,
                    memoryUsage: mem,
                }));
                return fps;
            } catch (err: any) {
                setState(s => ({ ...s, error: err.message, isProcessing: false }));
                throw err;
            }
        },
        []
    );

    const extractPeaks = useCallback(
        async (signal: Float32Array): Promise<Peak[]> => {
            if (!engineRef.current || engineRef.current.isDestroyed) {
                throw new Error('WASM engine not loaded or already destroyed');
            }
            setState(s => ({ ...s, isProcessing: true }));
            try {
                const peaks = engineRef.current.extractPeaks(signal);
                const mem = getWasmMemoryUsage();
                setState(s => ({
                    ...s,
                    peaks,
                    isProcessing: false,
                    memoryUsage: mem,
                }));
                return peaks;
            } catch (err: any) {
                setState(s => ({ ...s, error: err.message, isProcessing: false }));
                throw err;
            }
        },
        []
    );

    return { engine: engineRef.current, state, processSignal, extractPeaks, destroy };
}
