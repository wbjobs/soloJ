export const SAMPLE_RATE = 44100;
export const FRAME_SIZE = 4096;
export const HOP_SIZE = 1024;
export const RECORD_CHUNK_SIZE = 8192;

export async function decodeAudioFile(file: File): Promise<Float32Array> {
    const arrayBuffer = await file.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();

    try {
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const channelData = audioBuffer.getChannelData(0);

        if (audioBuffer.sampleRate === SAMPLE_RATE) {
            return channelData;
        }

        return resample(channelData, audioBuffer.sampleRate, SAMPLE_RATE);
    } finally {
        await ctx.close();
    }
}

export function resample(
    input: Float32Array,
    inputRate: number,
    outputRate: number
): Float32Array {
    if (inputRate === outputRate) return input;

    const ratio = outputRate / inputRate;
    const outputLength = Math.floor(input.length * ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
        const srcIdx = i / ratio;
        const idx0 = Math.floor(srcIdx);
        const idx1 = Math.min(idx0 + 1, input.length - 1);
        const frac = srcIdx - idx0;
        output[i] = input[idx0] * (1 - frac) + input[idx1] * frac;
    }

    return output;
}

export function downmixToMono(channelData: Float32Array[]): Float32Array {
    if (channelData.length === 1) return channelData[0];

    const length = channelData[0].length;
    const mono = new Float32Array(length);

    for (let i = 0; i < length; i++) {
        let sum = 0;
        for (const ch of channelData) {
            sum += ch[i];
        }
        mono[i] = sum / channelData.length;
    }

    return mono;
}

export function normalizeSignal(signal: Float32Array): Float32Array {
    let max = 0;
    for (let i = 0; i < signal.length; i++) {
        const abs = Math.abs(signal[i]);
        if (abs > max) max = abs;
    }

    if (max === 0) return signal;

    const normalized = new Float32Array(signal.length);
    for (let i = 0; i < signal.length; i++) {
        normalized[i] = signal[i] / max;
    }
    return normalized;
}

export function floatToInt16(signal: Float32Array): Int16Array {
    const output = new Int16Array(signal.length);
    for (let i = 0; i < signal.length; i++) {
        const s = Math.max(-1, Math.min(1, signal[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
}

export function computeRMS(signal: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < signal.length; i++) {
        sum += signal[i] * signal[i];
    }
    return Math.sqrt(sum / signal.length);
}
