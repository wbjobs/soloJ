import React, { useState, useCallback, useRef } from 'react';
import { useWasmEngine } from '../hooks/useWasmEngine';
import { decodeAudioFile, normalizeSignal, computeRMS } from '../services/audio';
import { api, MultiMatchResult, MultiQuerySegment } from '../services/api';
import { FingerprintData } from '../wasm/fingerprint_wasm';

interface SlotData {
    id: string;
    index: number;
    file: File | null;
    fileName: string;
    duration: number;
    rms: number;
    fingerprints: FingerprintData[];
    isProcessing: boolean;
    error: string | null;
    weight: number;
}

interface Props {
    maxSlots?: number;
    onMatchResult?: (results: MultiMatchResult[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const MultiQueryPanel: React.FC<Props> = ({ maxSlots = 3, onMatchResult }) => {
    const wasmEngine = useWasmEngine();
    const [slots, setSlots] = useState<SlotData[]>(() =>
        Array.from({ length: maxSlots }, (_, i) => ({
            id: generateId(),
            index: i,
            file: null,
            fileName: '',
            duration: 0,
            rms: 0,
            fingerprints: [],
            isProcessing: false,
            error: null,
            weight: 1.0,
        }))
    );

    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [isMatching, setIsMatching] = useState(false);
    const [message, setMessage] = useState<string>('');
    const [results, setResults] = useState<MultiMatchResult[]>([]);

    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleFileSelect = useCallback(
        async (slotIndex: number, file: File) => {
            setSlots(prev => {
                const next = [...prev];
                next[slotIndex] = {
                    ...next[slotIndex],
                    file,
                    fileName: file.name,
                    isProcessing: true,
                    error: null,
                    fingerprints: [],
                };
                return next;
            });

            try {
                const audioData = await decodeAudioFile(file);
                const normalized = normalizeSignal(audioData);
                const fps = await wasmEngine.processSignal(normalized);

                setSlots(prev => {
                    const next = [...prev];
                    next[slotIndex] = {
                        ...next[slotIndex],
                        duration: normalized.length / 44100,
                        rms: computeRMS(normalized),
                        fingerprints: fps,
                        isProcessing: false,
                    };
                    return next;
                });
            } catch (err: any) {
                setSlots(prev => {
                    const next = [...prev];
                    next[slotIndex] = {
                        ...next[slotIndex],
                        isProcessing: false,
                        error: err.message,
                    };
                    return next;
                });
            }
        },
        [wasmEngine]
    );

    const handleClearSlot = useCallback((slotIndex: number) => {
        setSlots(prev => {
            const next = [...prev];
            next[slotIndex] = {
                id: generateId(),
                index: slotIndex,
                file: null,
                fileName: '',
                duration: 0,
                rms: 0,
                fingerprints: [],
                isProcessing: false,
                error: null,
                weight: 1.0,
            };
            return next;
        });
        if (fileInputRefs.current[slotIndex]) {
            fileInputRefs.current[slotIndex]!.value = '';
        }
    }, []);

    const handleWeightChange = useCallback((slotIndex: number, weight: number) => {
        setSlots(prev => {
            const next = [...prev];
            next[slotIndex] = { ...next[slotIndex], weight };
            return next;
        });
    }, []);

    const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    }, [dragOverIndex]);

    const handleDragLeave = useCallback(() => {
        setDragOverIndex(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        const dragIndex = draggedIndex;
        setDraggedIndex(null);
        setDragOverIndex(null);

        if (dragIndex === null || dragIndex === dropIndex) return;

        setSlots(prev => {
            const next = [...prev];
            const [removed] = next.splice(dragIndex, 1);
            next.splice(dropIndex, 0, removed);
            return next.map((slot, i) => ({ ...slot, index: i }));
        });
    }, [draggedIndex]);

    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    }, []);

    const handleMatch = useCallback(async () => {
        const filledSlots = slots.filter(s => s.fingerprints.length > 0);
        if (filledSlots.length === 0) {
            setMessage('请至少上传一个音频片段');
            return;
        }

        setIsMatching(true);
        setMessage('正在执行多片段联合查询...');

        try {
            const segments: MultiQuerySegment[] = filledSlots.map(s => ({
                segment_id: s.fileName || `segment_${s.index}`,
                fingerprints: s.fingerprints,
                weight: s.weight,
            }));

            const matchResults = await api.matchMultiFingerprints({
                segments,
                mode: 'intersection',
            });

            setResults(matchResults);
            onMatchResult?.(matchResults);

            if (matchResults.length > 0) {
                setMessage(`找到 ${matchResults.length} 个同时匹配的音频`);
            } else {
                setMessage('未找到同时匹配所有片段的音频');
            }
        } catch (err: any) {
            setMessage(`查询失败: ${err.message}`);
        } finally {
            setIsMatching(false);
        }
    }, [slots, onMatchResult]);

    const handleReset = useCallback(() => {
        setSlots(
            Array.from({ length: maxSlots }, (_, i) => ({
                id: generateId(),
                index: i,
                file: null,
                fileName: '',
                duration: 0,
                rms: 0,
                fingerprints: [],
                isProcessing: false,
                error: null,
                weight: 1.0,
            }))
        );
        setResults([]);
        setMessage('');
    }, [maxSlots]);

    const allEmpty = slots.every(s => s.fingerprints.length === 0);
    const anyProcessing = slots.some(s => s.isProcessing);

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>多片段联合查询</h3>
            <p style={styles.hint}>
                上传 {maxSlots} 个音频片段，系统将返回同时匹配所有片段的完整音频。
                <br />
                支持拖拽调整查询优先级顺序（越靠前权重越高）。
            </p>

            <div style={styles.slotsContainer}>
                {slots.map((slot, index) => (
                    <div
                        key={slot.id}
                        draggable={slot.fingerprints.length > 0 || slot.file !== null}
                        onDragStart={e => handleDragStart(e, index)}
                        onDragOver={e => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        style={{
                            ...styles.slot,
                            ...(draggedIndex === index ? styles.slotDragging : {}),
                            ...(dragOverIndex === index && draggedIndex !== index
                                ? styles.slotDragOver
                                : {}),
                        }}
                    >
                        <div style={styles.slotHeader}>
                            <span style={styles.slotIndex}>#{index + 1}</span>
                            <span
                                style={styles.dragHandle}
                                title="拖拽调整顺序"
                            >
                                ⋮⋮
                            </span>
                        </div>

                        {slot.file ? (
                            <>
                                <div style={styles.slotContent}>
                                    <div style={styles.fileName} title={slot.fileName}>
                                        {slot.fileName}
                                    </div>
                                    <div style={styles.fileMeta}>
                                        时长: {slot.duration.toFixed(2)}s ·{' '}
                                        {slot.fingerprints.length > 0
                                            ? `${slot.fingerprints.length} 指纹`
                                            : '处理中...'}
                                    </div>
                                    <div style={styles.weightControl}>
                                        <span style={styles.weightLabel}>权重:</span>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="3"
                                            step="0.1"
                                            value={slot.weight}
                                            onChange={e =>
                                                handleWeightChange(index, parseFloat(e.target.value))
                                            }
                                            style={styles.weightSlider}
                                        />
                                        <span style={styles.weightValue}>
                                            {slot.weight.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleClearSlot(index)}
                                    style={styles.clearButton}
                                >
                                    清除
                                </button>
                            </>
                        ) : (
                            <label style={styles.uploadLabel}>
                                <input
                                    ref={el => (fileInputRefs.current[index] = el)}
                                    type="file"
                                    accept="audio/*"
                                    disabled={!wasmEngine.isLoaded}
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileSelect(index, file);
                                    }}
                                    style={{ display: 'none' }}
                                />
                                <div style={styles.uploadPlaceholder}>
                                    <div style={styles.uploadIcon}>📁</div>
                                    <div>点击上传音频片段</div>
                                </div>
                            </label>
                        )}

                        {slot.isProcessing && (
                            <div style={styles.processingOverlay}>
                                <div style={styles.spinner} />
                                <div>处理中...</div>
                            </div>
                        )}

                        {slot.error && (
                            <div style={styles.errorBadge}>{slot.error}</div>
                        )}
                    </div>
                ))}
            </div>

            <div style={styles.buttonRow}>
                <button
                    onClick={handleMatch}
                    disabled={allEmpty || anyProcessing || isMatching}
                    style={{
                        ...styles.matchButton,
                        opacity: allEmpty || anyProcessing || isMatching ? 0.5 : 1,
                    }}
                >
                    {isMatching ? '查询中...' : '联合查询'}
                </button>
                <button onClick={handleReset} style={styles.resetButton}>
                    重置
                </button>
            </div>

            {message && (
                <div style={styles.message}>{message}</div>
            )}

            {results.length > 0 && (
                <div style={styles.resultsBox}>
                    <h4 style={styles.resultsTitle}>匹配结果</h4>
                    <div style={styles.resultsHeader}>
                        <span style={styles.resultsHeaderLabel}>音频ID</span>
                        <span style={styles.resultsHeaderLabel}>综合得分</span>
                        {slots.filter(s => s.fingerprints.length > 0).map((s, i) => (
                            <span key={s.id} style={styles.resultsHeaderLabel}>
                                片段{i + 1}
                            </span>
                        ))}
                    </div>
                    {results.map((result, idx) => (
                        <div key={idx} style={styles.resultItem}>
                            <div style={styles.resultRank}>#{idx + 1}</div>
                            <div style={styles.resultId}>{result.audio_id}</div>
                            <div style={styles.resultScore}>
                                {(result.score * 100).toFixed(1)}%
                            </div>
                            {result.segment_scores.map((ss, i) => (
                                <div key={i} style={styles.segmentScore}>
                                    {(ss * 100).toFixed(0)}%
                                </div>
                            ))}
                            <div style={styles.progressBarWrap}>
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
                        </div>
                    ))}
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
    },
    title: {
        margin: 0,
        marginBottom: 8,
        fontSize: 18,
        fontWeight: 600,
        color: '#f1f5f9',
    },
    hint: {
        margin: 0,
        marginBottom: 20,
        fontSize: 12,
        color: '#94a3b8',
        lineHeight: 1.6,
    },
    slotsContainer: {
        display: 'flex',
        gap: 12,
        marginBottom: 20,
    },
    slot: {
        flex: 1,
        background: '#0f172a',
        border: '2px solid #334155',
        borderRadius: 12,
        padding: 16,
        minHeight: 180,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
        userSelect: 'none',
    },
    slotDragging: {
        opacity: 0.5,
        transform: 'rotate(2deg)',
    },
    slotDragOver: {
        borderColor: '#22d3ee',
        background: 'rgba(34, 211, 238, 0.1)',
        transform: 'scale(1.02)',
    },
    slotHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    slotIndex: {
        fontSize: 14,
        fontWeight: 700,
        color: '#22d3ee',
        background: '#334155',
        padding: '2px 10px',
        borderRadius: 20,
    },
    dragHandle: {
        color: '#64748b',
        cursor: 'grab',
        fontSize: 18,
        letterSpacing: -2,
    },
    slotContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    fileName: {
        fontSize: 13,
        fontWeight: 600,
        color: '#e2e8f0',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    fileMeta: {
        fontSize: 11,
        color: '#64748b',
    },
    weightControl: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    weightLabel: {
        fontSize: 11,
        color: '#94a3b8',
    },
    weightSlider: {
        flex: 1,
        cursor: 'pointer',
    },
    weightValue: {
        fontSize: 12,
        fontWeight: 600,
        color: '#22d3ee',
        minWidth: 36,
        textAlign: 'right',
    },
    uploadLabel: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: '2px dashed #334155',
        borderRadius: 8,
        transition: 'all 0.2s',
    },
    uploadPlaceholder: {
        textAlign: 'center',
        color: '#64748b',
        fontSize: 12,
    },
    uploadIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    clearButton: {
        marginTop: 12,
        padding: '6px 12px',
        background: '#334155',
        color: '#94a3b8',
        border: 'none',
        borderRadius: 6,
        fontSize: 12,
        cursor: 'pointer',
    },
    processingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        fontSize: 12,
        color: '#94a3b8',
    },
    spinner: {
        width: 24,
        height: 24,
        border: '2px solid #334155',
        borderTopColor: '#22d3ee',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginBottom: 8,
    },
    errorBadge: {
        marginTop: 8,
        padding: '4px 8px',
        background: '#7f1d1d',
        color: '#fca5a5',
        borderRadius: 4,
        fontSize: 11,
    },
    buttonRow: {
        display: 'flex',
        gap: 12,
        marginBottom: 16,
    },
    matchButton: {
        flex: 1,
        padding: '12px 24px',
        background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
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
    message: {
        padding: '10px 14px',
        background: '#0f172a',
        borderRadius: 6,
        fontSize: 13,
        color: '#94a3b8',
        border: '1px solid #334155',
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
    resultsHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: '#1e293b',
        borderRadius: 6,
        marginBottom: 8,
        fontSize: 11,
        color: '#64748b',
    },
    resultsHeaderLabel: {
        fontWeight: 600,
    },
    resultItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: '#1e293b',
        borderRadius: 6,
        marginBottom: 8,
    },
    resultRank: {
        fontSize: 14,
        fontWeight: 700,
        color: '#22d3ee',
        minWidth: 32,
    },
    resultId: {
        flex: 1,
        fontSize: 13,
        fontWeight: 600,
        color: '#f1f5f9',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    resultScore: {
        fontSize: 13,
        fontWeight: 700,
        color: '#22c55e',
        minWidth: 60,
        textAlign: 'right',
    },
    segmentScore: {
        fontSize: 11,
        color: '#94a3b8',
        minWidth: 48,
        textAlign: 'center',
    },
    progressBarWrap: {
        width: 120,
    },
    progressBar: {
        height: 6,
        background: '#334155',
        borderRadius: 4,
        overflow: 'hidden',
    },
};
