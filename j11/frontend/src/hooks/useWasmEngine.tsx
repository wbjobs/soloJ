import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback,
    ReactNode,
} from 'react';
import {
    createFingerprintEngine,
    destroyFingerprintEngine,
    FingerprintEngine,
    FingerprintData,
    Peak,
    getWasmMemoryUsage,
    getActiveEngineCount,
} from '../wasm/fingerprint_wasm';

interface WasmEngineState {
    engine: FingerprintEngine | null;
    isLoaded: boolean;
    isProcessing: boolean;
    error: string | null;
    memoryUsage: {
        used: number;
        total: number;
        megabytes: number;
    };
    activeEngineCount: number;
    lastPeaks: Peak[];
    lastFingerprints: FingerprintData[];
}

interface WasmEngineContextType extends WasmEngineState {
    processSignal: (signal: Float32Array) => Promise<FingerprintData[]>;
    extractPeaks: (signal: Float32Array) => Promise<Peak[]>;
    resetCache: () => void;
}

const WasmEngineContext = createContext<WasmEngineContextType | null>(null);

export const WasmEngineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<WasmEngineState>({
        engine: null,
        isLoaded: false,
        isProcessing: false,
        error: null,
        memoryUsage: { used: 0, total: 0, megabytes: 0 },
        activeEngineCount: 0,
        lastPeaks: [],
        lastFingerprints: [],
    });

    const engineRef = useRef<FingerprintEngine | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        createFingerprintEngine({
            sampleRate: 44100,
            frameSize: 4096,
            hopSize: 1024,
        })
            .then(engine => {
                if (!isMountedRef.current) {
                    destroyFingerprintEngine(engine);
                    return;
                }
                engineRef.current = engine;
                const mem = getWasmMemoryUsage();
                setState(s => ({
                    ...s,
                    engine,
                    isLoaded: true,
                    memoryUsage: mem,
                    activeEngineCount: getActiveEngineCount(),
                }));
            })
            .catch(err => {
                if (isMountedRef.current) {
                    setState(s => ({ ...s, error: err.message }));
                }
            });

        const memoryInterval = setInterval(() => {
            if (isMountedRef.current) {
                setState(s => ({
                    ...s,
                    memoryUsage: getWasmMemoryUsage(),
                    activeEngineCount: getActiveEngineCount(),
                }));
            }
        }, 2000);

        return () => {
            isMountedRef.current = false;
            clearInterval(memoryInterval);
            if (engineRef.current) {
                destroyFingerprintEngine(engineRef.current);
                engineRef.current = null;
            }
        };
    }, []);

    const processSignal = useCallback(
        async (signal: Float32Array): Promise<FingerprintData[]> => {
            if (!engineRef.current || engineRef.current.isDestroyed) {
                throw new Error('WASM engine not available');
            }
            setState(s => ({ ...s, isProcessing: true, error: null }));
            try {
                const fps = engineRef.current.generateFingerprints(signal);
                const mem = getWasmMemoryUsage();
                setState(s => ({
                    ...s,
                    isProcessing: false,
                    lastFingerprints: fps,
                    memoryUsage: mem,
                    activeEngineCount: getActiveEngineCount(),
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
                throw new Error('WASM engine not available');
            }
            setState(s => ({ ...s, isProcessing: true, error: null }));
            try {
                const peaks = engineRef.current.extractPeaks(signal);
                const mem = getWasmMemoryUsage();
                setState(s => ({
                    ...s,
                    isProcessing: false,
                    lastPeaks: peaks,
                    memoryUsage: mem,
                    activeEngineCount: getActiveEngineCount(),
                }));
                return peaks;
            } catch (err: any) {
                setState(s => ({ ...s, error: err.message, isProcessing: false }));
                throw err;
            }
        },
        []
    );

    const resetCache = useCallback(() => {
        setState(s => ({ ...s, lastPeaks: [], lastFingerprints: [] }));
    }, []);

    return (
        <WasmEngineContext.Provider
            value={{
                ...state,
                processSignal,
                extractPeaks,
                resetCache,
            }}
        >
            {children}
        </WasmEngineContext.Provider>
    );
};

export function useWasmEngine(): WasmEngineContextType {
    const ctx = useContext(WasmEngineContext);
    if (!ctx) {
        throw new Error('useWasmEngine must be used within WasmEngineProvider');
    }
    return ctx;
}

export { WasmEngineContext };
