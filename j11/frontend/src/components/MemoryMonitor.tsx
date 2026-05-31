import React, { useState, useEffect } from 'react';
import { useWasmEngine } from '../hooks/useWasmEngine';
import { destroyAllEngines } from '../wasm/fingerprint_wasm';

export const MemoryMonitor: React.FC = () => {
    const wasmEngine = useWasmEngine();
    const [history, setHistory] = useState<number[]>([]);
    const [maxHistory] = useState(30);

    useEffect(() => {
        const interval = setInterval(() => {
            setHistory(prev => {
                const next = [...prev, wasmEngine.memoryUsage.megabytes];
                if (next.length > maxHistory) {
                    next.shift();
                }
                return next;
            });
        }, 2000);
        return () => clearInterval(interval);
    }, [wasmEngine.memoryUsage.megabytes, maxHistory]);

    const handleForceCleanup = () => {
        destroyAllEngines();
        console.log('Forced WASM engine cleanup completed');
    };

    const maxMB = Math.max(...history, 16);
    const minMB = Math.min(...history, 0);
    const range = maxMB - minMB || 1;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <span style={styles.title}>WASM 内存监控</span>
                <button onClick={handleForceCleanup} style={styles.cleanupBtn}>
                    强制清理
                </button>
            </div>

            <div style={styles.stats}>
                <div style={styles.stat}>
                    <div style={styles.statLabel}>内存使用</div>
                    <div style={styles.statValue}>
                        {wasmEngine.memoryUsage.megabytes.toFixed(2)} MB
                    </div>
                </div>
                <div style={styles.stat}>
                    <div style={styles.statLabel}>活跃引擎</div>
                    <div style={styles.statValue}>
                        {wasmEngine.activeEngineCount}
                    </div>
                </div>
                <div style={styles.stat}>
                    <div style={styles.statLabel}>峰值</div>
                    <div style={styles.statValue}>
                        {history.length > 0 ? Math.max(...history).toFixed(2) : '0.00'} MB
                    </div>
                </div>
            </div>

            {history.length > 1 && (
                <div style={styles.chart}>
                    <svg width="100%" height="60" viewBox={`0 0 ${history.length * 10} 60`}>
                        <polyline
                            fill="none"
                            stroke="#22d3ee"
                            strokeWidth="2"
                            points={history
                                .map((v, i) => {
                                    const x = i * 10;
                                    const y = 60 - ((v - minMB) / range) * 50;
                                    return `${x},${y}`;
                                })
                                .join(' ')}
                        />
                    </svg>
                </div>
            )}

            <div style={styles.hint}>
                控制台执行: <code style={styles.code}>getWasmMemoryStats()</code> 查看详情
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: 280,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #334155',
        borderRadius: 12,
        padding: 12,
        zIndex: 9999,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        fontSize: 12,
        fontWeight: 600,
        color: '#94a3b8',
    },
    cleanupBtn: {
        padding: '4px 8px',
        fontSize: 10,
        background: '#334155',
        color: '#e2e8f0',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
    },
    stats: {
        display: 'flex',
        gap: 12,
        marginBottom: 8,
    },
    stat: {
        flex: 1,
    },
    statLabel: {
        fontSize: 10,
        color: '#64748b',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 14,
        fontWeight: 700,
        color: '#22d3ee',
    },
    chart: {
        background: '#0f172a',
        borderRadius: 4,
        padding: 4,
        marginBottom: 8,
    },
    hint: {
        fontSize: 10,
        color: '#64748b',
    },
    code: {
        background: '#334155',
        padding: '2px 4px',
        borderRadius: 3,
        fontFamily: 'monospace',
    },
};
