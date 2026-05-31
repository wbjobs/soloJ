import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface AudioItem {
    audio_id: string;
    fingerprint_count: number;
    duration: number;
}

export const AudioLibrary: React.FC = () => {
    const [items, setItems] = useState<AudioItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [refreshKey, setRefreshKey] = useState(0);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const list = await api.getAudioList();
            setItems(list);
            setError('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load, refreshKey]);

    const handleDelete = useCallback(async (audioId: string) => {
        try {
            await api.deleteAudio(audioId);
            setItems(prev => prev.filter(i => i.audio_id !== audioId));
        } catch (err: any) {
            setError(err.message);
        }
    }, []);

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>指纹库</h3>
                <button onClick={() => setRefreshKey(k => k + 1)} style={styles.refreshButton}>
                    刷新
                </button>
            </div>

            {isLoading && <div style={styles.loading}>加载中...</div>}
            {error && <div style={styles.error}>{error}</div>}

            {!isLoading && items.length === 0 && (
                <div style={styles.empty}>指纹库为空，请上传音频文件建立指纹</div>
            )}

            {items.length > 0 && (
                <div style={styles.list}>
                    {items.map((item, idx) => (
                        <div key={item.audio_id} style={styles.item}>
                            <div style={styles.itemIndex}>{idx + 1}</div>
                            <div style={styles.itemInfo}>
                                <div style={styles.itemId}>{item.audio_id}</div>
                                <div style={styles.itemMeta}>
                                    {item.fingerprint_count} 指纹 · {item.duration.toFixed(2)}s
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(item.audio_id)}
                                style={styles.deleteButton}
                            >
                                删除
                            </button>
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
        marginTop: 24,
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        margin: 0,
        fontSize: 18,
        fontWeight: 600,
        color: '#f1f5f9',
    },
    refreshButton: {
        padding: '6px 16px',
        background: '#334155',
        color: '#e2e8f0',
        border: 'none',
        borderRadius: 6,
        fontSize: 13,
        cursor: 'pointer',
    },
    loading: {
        padding: 24,
        textAlign: 'center',
        color: '#94a3b8',
    },
    error: {
        padding: 12,
        background: '#7f1d1d',
        color: '#fca5a5',
        borderRadius: 6,
        fontSize: 13,
    },
    empty: {
        padding: 24,
        textAlign: 'center',
        color: '#64748b',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        padding: 12,
        background: '#0f172a',
        borderRadius: 8,
    },
    itemIndex: {
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#334155',
        borderRadius: '50%',
        fontSize: 13,
        fontWeight: 600,
        color: '#94a3b8',
        marginRight: 12,
    },
    itemInfo: {
        flex: 1,
    },
    itemId: {
        fontSize: 14,
        fontWeight: 600,
        color: '#f1f5f9',
        marginBottom: 4,
    },
    itemMeta: {
        fontSize: 12,
        color: '#64748b',
    },
    deleteButton: {
        padding: '6px 12px',
        background: '#7f1d1d',
        color: '#fca5a5',
        border: 'none',
        borderRadius: 6,
        fontSize: 12,
        cursor: 'pointer',
    },
};
