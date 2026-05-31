import { useState, useRef, useCallback, useEffect } from 'react';

export interface RecorderState {
    isRecording: boolean;
    isPaused: boolean;
    audioChunks: Float32Array[];
    duration: number;
    error: string | null;
}

export interface RecorderAPI {
    start: () => Promise<void>;
    stop: () => Float32Array;
    pause: () => void;
    resume: () => void;
    reset: () => void;
    getCombined: () => Float32Array;
    state: RecorderState;
}

const SAMPLE_RATE = 44100;
const CHUNK_SIZE = 8192;

export function useAudioRecorder(): RecorderAPI {
    const [state, setState] = useState<RecorderState>({
        isRecording: false,
        isPaused: false,
        audioChunks: [],
        duration: 0,
        error: null,
    });

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Float32Array[]>([]);
    const startTimeRef = useRef<number>(0);

    const getCombined = useCallback((): Float32Array => {
        const chunks = chunksRef.current;
        let totalLen = 0;
        for (const c of chunks) totalLen += c.length;

        const combined = new Float32Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
            combined.set(c, offset);
            offset += c.length;
        }
        return combined;
    }, []);

    const start = useCallback(async () => {
        try {
            setState(s => ({ ...s, error: null }));

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: SAMPLE_RATE,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });
            streamRef.current = stream;

            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx({ sampleRate: SAMPLE_RATE });
            audioContextRef.current = ctx;

            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            analyserRef.current = analyser;

            const processor = ctx.createScriptProcessor(CHUNK_SIZE, 1, 1);
            scriptProcessorRef.current = processor;

            chunksRef.current = [];

            processor.onaudioprocess = (e) => {
                const channelData = e.inputBuffer.getChannelData(0);
                chunksRef.current.push(new Float32Array(channelData));
            };

            source.connect(analyser);
            analyser.connect(processor);
            processor.connect(ctx.destination);

            startTimeRef.current = ctx.currentTime;

            setState(s => ({
                ...s,
                isRecording: true,
                isPaused: false,
                audioChunks: [],
                duration: 0,
            }));
        } catch (err: any) {
            setState(s => ({ ...s, error: err.message || '录音失败' }));
        }
    }, []);

    const stop = useCallback((): Float32Array => {
        try {
            scriptProcessorRef.current?.disconnect();
            analyserRef.current?.disconnect();
            sourceRef.current?.disconnect();
            streamRef.current?.getTracks().forEach(t => t.stop());
            audioContextRef.current?.close();

            scriptProcessorRef.current = null;
            analyserRef.current = null;
            sourceRef.current = null;
            streamRef.current = null;
            audioContextRef.current = null;
        } catch (_) {
            // ignore cleanup errors
        }

        const combined = getCombined();
        const duration = combined.length / SAMPLE_RATE;

        setState(s => ({
            ...s,
            isRecording: false,
            isPaused: false,
            duration,
        }));

        return combined;
    }, [getCombined]);

    const pause = useCallback(() => {
        setState(s => ({ ...s, isPaused: true }));
    }, []);

    const resume = useCallback(() => {
        setState(s => ({ ...s, isPaused: false }));
    }, []);

    const reset = useCallback(() => {
        chunksRef.current = [];
        setState({
            isRecording: false,
            isPaused: false,
            audioChunks: [],
            duration: 0,
            error: null,
        });
    }, []);

    useEffect(() => {
        return () => {
            try {
                scriptProcessorRef.current?.disconnect();
                analyserRef.current?.disconnect();
                sourceRef.current?.disconnect();
                streamRef.current?.getTracks().forEach(t => t.stop());
                audioContextRef.current?.close();
            } catch (_) { /* ignore */ }
        };
    }, []);

    return { start, stop, pause, resume, reset, getCombined, state };
}
