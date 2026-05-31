import React, { useState, useEffect } from 'react';
import { WasmEngineProvider } from './hooks/useWasmEngine';
import { AudioUploader } from './components/AudioUploader';
import { AudioRecorder } from './components/AudioRecorder';
import { AudioLibrary } from './components/AudioLibrary';
import { MultiQueryPanel } from './components/MultiQueryPanel';
import { api } from './services/api';
import { getActiveEngineCount, getWasmMemoryUsage } from './wasm/fingerprint_wasm';

type Tab = 'upload' | 'record' | 'multi' | 'library';

function AppContent() {
    const [activeTab, setActiveTab] = useState<Tab>('upload');
    const [health, setHealth] = useState<{ status: string; fingerprint_count: number; audio_count: number; hash_index_count: number } | null>(null);

    useEffect(() => {
        api.healthCheck()
            .then(h => setHealth(h))
            .catch(() => setHealth(null));
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            console.debug('[WASM Memory]', {
                activeEngines: getActiveEngineCount(),
                memoryMB: getWasmMemoryUsage().megabytes.toFixed(2),
            });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={styles.app}>
            <header style={styles.header}>
                <div style={styles.headerContent}>
                    <h1 style={styles.title}>音频指纹识别系统</h1>
                    <div style={styles.subtitle}>
                        React + TypeScript · C++ WASM · Go + RocksDB
                    </div>
                </div>
                <div style={styles.healthBox}>
                    <div style={styles.healthLabel}>后端状态</div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: health ? '#22c55e' : '#ef4444',
                    }}>
                        <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: health ? '#22c55e' : '#ef4444',
                        }} />
                        {health ? `在线 (${health.audio_count} 音频, ${health.fingerprint_count} 指纹, ${health.hash_index_count} 索引)` : '离线'}
                    </div>
                </div>
            </header>

            <nav style={styles.nav}>
                <button
                    onClick={() => setActiveTab('upload')}
                    style={{
                        ...styles.navButton,
                        ...(activeTab === 'upload' ? styles.navButtonActive : {}),
                    }}
                >
                    上传音频
                </button>
                <button
                    onClick={() => setActiveTab('record')}
                    style={{
                        ...styles.navButton,
                        ...(activeTab === 'record' ? styles.navButtonActive : {}),
                    }}
                >
                    录音识别
                </button>
                <button
                    onClick={() => setActiveTab('multi')}
                    style={{
                        ...styles.navButton,
                        ...(activeTab === 'multi' ? styles.navButtonActive : {}),
                    }}
                >
                    联合查询
                </button>
                <button
                    onClick={() => setActiveTab('library')}
                    style={{
                        ...styles.navButton,
                        ...(activeTab === 'library' ? styles.navButtonActive : {}),
                    }}
                >
                    指纹库
                </button>
            </nav>

            <main style={styles.main}>
                {activeTab === 'upload' && (
                    <AudioUploader onStored={() => setActiveTab('library')} />
                )}
                {activeTab === 'record' && <AudioRecorder />}
                {activeTab === 'multi' && <MultiQueryPanel />}
                {activeTab === 'library' && <AudioLibrary />}
            </main>

            <footer style={styles.footer}>
                <p>音频指纹识别系统 · 基于 Shazam 指纹算法 · WASM 内存已自动管理</p>
            </footer>
        </div>
    );
}

function App() {
    return (
        <WasmEngineProvider>
            <AppContent />
        </WasmEngineProvider>
    );
}

const styles: Record<string, React.CSSProperties> = {
    app: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
    },
    header: {
        padding: '24px 48px',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerContent: {},
    title: {
        margin: 0,
        fontSize: 24,
        fontWeight: 700,
        color: '#f1f5f9',
        background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#64748b',
    },
    healthBox: {
        background: '#1e293b',
        padding: '10px 16px',
        borderRadius: 8,
        fontSize: 12,
    },
    healthLabel: {
        color: '#64748b',
        marginBottom: 2,
    },
    nav: {
        display: 'flex',
        gap: 4,
        padding: '16px 48px 0',
        borderBottom: '1px solid #1e293b',
    },
    navButton: {
        padding: '12px 24px',
        background: 'none',
        border: 'none',
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        borderBottom: '2px solid transparent',
        marginBottom: -1,
        transition: 'all 0.2s',
    },
    navButtonActive: {
        color: '#22d3ee',
        borderBottomColor: '#22d3ee',
    },
    main: {
        flex: 1,
        padding: '32px 48px',
        maxWidth: 900,
        margin: '0 auto',
        width: '100%',
    },
    footer: {
        padding: '24px 48px',
        textAlign: 'center',
        fontSize: 12,
        color: '#475569',
        borderTop: '1px solid #1e293b',
    },
};

export default App;
