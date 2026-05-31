import React, { useState, useCallback } from 'react';
import { decodeAudioFile, normalizeSignal, computeRMS } from '../services/audio';
import { useWasmEngine } from '../hooks/useWasmEngine';
import { api } from '../services/api';
import { FingerprintVisualizer } from './FingerprintVisualizer';
import { Peak } from '../wasm/fingerprint_wasm';

interface Props {
    onStored?: (audioId: string) => void;
}

export const AudioUploader: React.FC<Props> = ({ onStored }) => {
    const [fileName, setFileName] = useState<string>('');
    const [duration, setDuration] = useState<number>(0);
    const [rms, setRms] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isStoring, setIsStoring] = useState(false);
    const [message, setMessage] = useState<string>('');
    const [audioId, setAudioId] = useState<string>('');
    const [peaks, setPeaks] = useState<Peak[]>([]);
    const [fingerprints, setFingerprints] = useState<any[]>([]);

    const wasmEngine = useWasmEngine();

    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            setFileName(file.name);
            setMessage('正在解码音频文件...');
            setIsProcessing(true);
            setPeaks([]);
            setFingerprints([]);

            try {
                const audioData = await decodeAudioFile(file);
                const normalized = normalizeSignal(audioData);

                const durationSec = normalized.length / 44100;
                setDuration(durationSec);
                setRms(computeRMS(normalized));

                setMessage('正在提取指纹...');
                const fps = await wasmEngine.processSignal(normalized);
                const extractedPeaks = await wasmEngine.extractPeaks(normalized);

                setPeaks(extractedPeaks);
                setFingerprints(fps);

                const defaultId = file.name.replace(/\.[^/.]+$/, '');
                setAudioId(defaultId);

                setMessage(`指纹提取完成，共 ${fps.length} 个指纹`);
            } catch (err: any) {
                setMessage(`处理失败: ${err.message}`);
            } finally {
                setIsProcessing(false);
            }
        },
        [wasmEngine]
    );

    const handleStore = useCallback(async () => {
        if (fingerprints.length === 0 || !audioId.trim()) {
            setMessage('请先上传音频文件并输入音频ID');
            return;
        }

        setIsStoring(true);
        setMessage('正在存储指纹到服务器...');

        try {
            await api.storeFingerprints({
                audio_id: audioId,
                fingerprints,
                duration,
            });
            setMessage(`存储成功！音频ID: ${audioId}`);
            onStored?.(audioId);
        } catch (err: any) {
            setMessage(`存储失败: ${err.message}`);
        } finally {
            setIsStoring(false);
        }
    }, [fingerprints, audioId, duration, onStored]);

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>上传音频文件</h3>

            <div style={styles.row}>
                <label style={styles.label}>
                    选择音频文件:
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileChange}
                        disabled={isProcessing || !wasmEngine.isLoaded}
                        style={styles.fileInput}
                    />
                </label>
            </div>

            {wasmEngine.isLoaded && (
                <div style={styles.memoryInfo}>
                    WASM 引擎就绪 · 内存: {wasmEngine.memoryUsage.megabytes.toFixed(2)} MB · 
                    活跃引擎: {wasmEngine.activeEngineCount}
                </div>
            )}

            {fileName && (
                <>
                    <div style={styles.infoBox}>
                        <div>文件名: {fileName}</div>
                        <div>时长: {duration.toFixed(2)} 秒</div>
                        <div>RMS: {rms.toFixed(4)}</div>
                        <div>指纹数: {fingerprints.length}</div>
                    </div>

                    <div style={styles.row}>
                        <label style={styles.label}>
                            音频ID:
                            <input
                                type="text"
                                value={audioId}
                                onChange={e => setAudioId(e.target.value)}
                                style={styles.textInput}
                            />
                        </label>
                    </div>

                    {peaks.length > 0 && (
                        <div style={styles.visualizerWrap}>
                            <FingerprintVisualizer
                                peaks={peaks}
                                frameSize={4096}
                                sampleRate={44100}
                                hopSize={1024}
                                width={780}
                                height={250}
                            />
                        </div>
                    )}

                    <button
                        onClick={handleStore}
                        disabled={isStoring || fingerprints.length === 0}
                        style={{
                            ...styles.button,
                            opacity: isStoring || fingerprints.length === 0 ? 0.5 : 1,
                        }}
                    >
                        {isStoring ? '存储中...' : '存储到指纹库'}
                    </button>
                </>
            )}

            {message && (
                <div style={styles.message}>{message}</div>
            )}

            {wasmEngine.error && (
                <div style={{ ...styles.message, ...styles.error }}>
                    WASM 错误: {wasmEngine.error}
                </div>
            )}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        background: '#1e293b',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px',
    },
    title: {
        margin: 0,
        marginBottom: 16,
        fontSize: 18,
        fontWeight: 600,
        color: '#f1f5f9',
    },
    row: {
        marginBottom: 12,
    },
    label: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 14,
        color: '#94a3b8',
    },
    fileInput: {
        padding: 8,
        background: '#334155',
        color: '#e2e8f0',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
    },
    textInput: {
        padding: '8px 12px',
        background: '#334155',
        color: '#e2e8f0',
        border: '1px solid #475569',
        borderRadius: 6,
        fontSize: 14,
        width: 300,
    },
    infoBox: {
        background: '#0f172a',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 13,
        lineHeight: 1.8,
        color: '#cbd5e1',
    },
    memoryInfo: {
        padding: '8px 12px',
        background: '#0f172a',
        borderRadius: 6,
        marginBottom: 12,
        fontSize: 11,
        color: '#64748b',
    },
    visualizerWrap: {
        marginTop: 16,
        marginBottom: 16,
    },
    button: {
        padding: '10px 24px',
        background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
    },
    message: {
        marginTop: 12,
        padding: '10px 14px',
        background: '#0f172a',
        borderRadius: 6,
        fontSize: 13,
        color: '#94a3b8',
        border: '1px solid #334155',
    },
    error: {
        background: '#7f1d1d',
        color: '#fca5a5',
        borderColor: '#b91c1c',
    },
};
