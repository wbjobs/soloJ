import React, { useState, useCallback } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useWasmEngine } from '../hooks/useWasmEngine';
import { normalizeSignal } from '../services/audio';
import { api, MatchResult } from '../services/api';
import { FingerprintVisualizer } from './FingerprintVisualizer';
import { Peak } from '../wasm/fingerprint_wasm';

interface Props {
    onMatchResult?: (results: MatchResult[]) => void;
}

export const AudioRecorder: React.FC<Props> = ({ onMatchResult }) => {
    const { state: recState, start, stop, reset } = useAudioRecorder();
    const wasmEngine = useWasmEngine();

    const [peaks, setPeaks] = useState<Peak[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isMatching, setIsMatching] = useState(false);
    const [message, setMessage] = useState<string>('');
    const [matchResults, setMatchResults] = useState<MatchResult[]>([]);

    const handleStart = useCallback(() => {
        reset();
        setPeaks([]);
        setMessage('正在录音...');
        setMatchResults([]);
        start();
    }, [reset, start]);

    const handleStop = useCallback(async () => {
        const signal = stop();
        setMessage(`录音完成，时长 ${(signal.length / 44100).toFixed(2)} 秒，正在处理...`);
        setIsProcessing(true);

        try {
            const normalized = normalizeSignal(signal);
            const fps = await wasmEngine.processSignal(normalized);
            const extractedPeaks = await wasmEngine.extractPeaks(normalized);
            setPeaks(extractedPeaks);

            setMessage(`指纹提取完成，共 ${fps.length} 个指纹，正在匹配...`);
            setIsMatching(true);

            const results = await api.matchFingerprints({
                fingerprints: fps,
            });

            setMatchResults(results);
            onMatchResult?.(results);

            if (results.length > 0) {
                setMessage(`匹配完成，找到 ${results.length} 个结果`);
            } else {
                setMessage('匹配完成，未找到匹配的音频');
            }
        } catch (err: any) {
            setMessage(`处理失败: ${err.message}`);
        } finally {
            setIsProcessing(false);
            setIsMatching(false);
        }
    }, [stop, wasmEngine, onMatchResult]);

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>实时录音识别</h3>

            <div style={styles.buttonRow}>
                {!recState.isRecording ? (
                    <button
                        onClick={handleStart}
                        style={styles.recordButton}
                        disabled={!wasmEngine.isLoaded}
                    >
                        <span style={styles.recordingDot} />
                        开始录音
                    </button>
                ) : (
                    <button onClick={handleStop} style={styles.stopButton}>
                        <span style={styles.stopIcon} />
                        停止并识别
                    </button>
                )}
                <button onClick={reset} style={styles.resetButton}>
                    重置
                </button>
            </div>

            <div style={styles.statusBox}>
                {recState.isRecording && (
                    <div style={styles.recordingStatus}>
                        <span style={styles.pulseDot} />
                        录音中...
                    </div>
                )}
                {isProcessing && <div>正在处理音频数据...</div>}
                {isMatching && <div>正在匹配指纹库...</div>}
                {wasmEngine.isLoaded && (
                    <div style={styles.memoryInfo}>
                        WASM 内存: {wasmEngine.memoryUsage.megabytes.toFixed(2)} MB | 
                        活跃引擎: {wasmEngine.activeEngineCount}
                    </div>
                )}
            </div>

            {peaks.length > 0 && (
                <div style={styles.visualizerWrap}>
                    <FingerprintVisualizer
                        peaks={peaks}
                        frameSize={4096}
                        sampleRate={44100}
                        hopSize={1024}
                        width={780}
                        height={200}
                    />
                </div>
            )}

            {matchResults.length > 0 && (
                <div style={styles.resultsBox}>
                    <h4 style={styles.resultsTitle}>匹配结果</h4>
                    {matchResults.map((result, idx) => (
                        <div key={idx} style={styles.resultItem}>
                            <div style={styles.resultHeader}>
                                <span style={styles.resultRank}>#{idx + 1}</span>
                                <span style={styles.resultId}>{result.audio_id}</span>
                            </div>
                            <div style={styles.resultDetails}>
                                <div>相似度: {(result.score * 100).toFixed(2)}%</div>
                                <div>
                                    匹配指纹: {result.matched_hashes} / {result.total_hashes}
                                </div>
                            </div>
                            <div style={styles.progressBar}>
                                <div
                                    style={{
                                        width: `${Math.min(result.score * 100, 100)}%`,
                                        height: '100%',
                                        background:
                                            result.score > 0.7
                                                ? '#22c55e'
                                                : result.score > 0.3
                                                    ? '#eab308'
                                                    : '#ef4444',
                                        borderRadius: 4,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {message && (
                <div style={styles.message}>{message}</div>
            )}

            {wasmEngine.error && (
                <div style={{ ...styles.message, ...styles.error }}>
                    WASM 错误: {wasmEngine.error}
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        background: '#1e293b',
        padding: '24px',
        borderRadius: '12px',
    },
    title: {
        margin: 0,
        marginBottom: 16,
        fontSize: 18,
        fontWeight: 600,
        color: '#f1f5f9',
    },
    buttonRow: {
        display: 'flex',
        gap: 12,
        marginBottom: 16,
    },
    recordButton: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        background: '#ef4444',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
    },
    stopButton: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        background: '#64748b',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
    },
    resetButton: {
        padding: '12px 20px',
        background: '#334155',
        color: '#e2e8f0',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        cursor: 'pointer',
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: '#fca5a5',
    },
    stopIcon: {
        width: 10,
        height: 10,
        background: '#e2e8f0',
    },
    pulseDot: {
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: '#ef4444',
        animation: 'pulse 1.5s ease-in-out infinite',
        marginRight: 8,
    },
    statusBox: {
        padding: 12,
        background: '#0f172a',
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 13,
        color: '#94a3b8',
        minHeight: 40,
    },
    recordingStatus: {
        display: 'flex',
        alignItems: 'center',
    },
    memoryInfo: {
        marginTop: 4,
        fontSize: 11,
        color: '#64748b',
    },
    visualizerWrap: {
        marginTop: 16,
        marginBottom: 16,
    },
    resultsBox: {
        marginTop: 16,
        padding: 16,
        background: '#0f172a',
        borderRadius: 8,
    },
    resultsTitle: {
        margin: 0,
        marginBottom: 12,
        fontSize: 15,
        fontWeight: 600,
        color: '#f1f5f9',
    },
    resultItem: {
        padding: 12,
        background: '#1e293b',
        borderRadius: 6,
        marginBottom: 8,
    },
    resultHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    resultRank: {
        fontSize: 16,
        fontWeight: 700,
        color: '#22d3ee',
    },
    resultId: {
        fontSize: 14,
        fontWeight: 600,
        color: '#f1f5f9',
    },
    resultDetails: {
        fontSize: 12,
        color: '#94a3b8',
        display: 'flex',
        gap: 16,
        marginBottom: 8,
    },
    progressBar: {
        height: 6,
        background: '#334155',
        borderRadius: 4,
        overflow: 'hidden',
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
