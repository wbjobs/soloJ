<script>
    import ModelViewer from '$lib/components/ModelViewer.svelte';
    import ParameterPanel from '$lib/components/ParameterPanel.svelte';
    import BandStructureChart from '$lib/components/BandStructureChart.svelte';
    import OptimizationPanel from '$lib/components/OptimizationPanel.svelte';
    import OptimizationHistoryChart from '$lib/components/OptimizationHistoryChart.svelte';
    import AnalysisPanel from '$lib/components/AnalysisPanel.svelte';
    import SensitivityRadarChart from '$lib/components/SensitivityRadarChart.svelte';
    import { allParams, optimizationStatus, bandStructureData, transmissionLossData, sensitivityData } from '$lib/stores/params.js';
    import { computeSingle } from '$lib/services/api.js';

    let computing = false;
    let activeTab = 'optimization';

    async function handleCompute() {
        computing = true;
        try {
            const result = await computeSingle($allParams, {
                computeBandStructure: true,
                computeTransmissionLoss: true
            });

            if (result.band_structure) {
                $bandStructureData = result.band_structure;
            }
            if (result.transmission_loss) {
                $transmissionLossData = result.transmission_loss;
            }
        } catch (error) {
            console.error('Compute failed:', error);
        } finally {
            computing = false;
        }
    }
</script>

<svelte:head>
    <title>声学超材料逆向设计系统</title>
</svelte:head>

<div class="app-layout">
    <header class="app-header">
        <div class="header-left">
            <div class="logo">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#3b82f6" stroke-width="1.5"/>
                    <circle cx="12" cy="12" r="6" stroke="#06b6d4" stroke-width="1.5"/>
                    <circle cx="12" cy="12" r="2" fill="#8b5cf6"/>
                    <line x1="12" y1="2" x2="12" y2="22" stroke="#1e3a5f" stroke-width="0.5"/>
                    <line x1="2" y1="12" x2="22" y2="12" stroke="#1e3a5f" stroke-width="0.5"/>
                </svg>
            </div>
            <div class="header-title">
                <h1>声学超材料逆向设计系统</h1>
                <span class="subtitle">Acoustic Metamaterial Inverse Design</span>
            </div>
        </div>
        <div class="header-right">
            <span class="status-dot" class:active={$optimizationStatus === 'running'}></span>
            <span class="status-text">
                {#if $optimizationStatus === 'running'}优化运行中{:else}系统就绪{/if}
            </span>
        </div>
    </header>

    <main class="app-main">
        <aside class="sidebar-left card">
            <ParameterPanel />
        </aside>

        <section class="center-panel">
            <div class="viewer-section card">
                <ModelViewer />
            </div>
            <div class="actions-bar">
                <button class="btn btn-primary" on:click={handleCompute} disabled={computing}>
                    {#if computing}
                        <span class="animate-spin">⟳</span>
                        计算中...
                    {:else}
                        ⚡ 计算能带结构
                    {/if}
                </button>
            </div>
        </section>

        <aside class="sidebar-right">
            <div class="sidebar-tabs">
                <button class="tab-btn" class:active={activeTab === 'optimization'} on:click={() => activeTab = 'optimization'}>
                    🎯 优化
                </button>
                <button class="tab-btn" class:active={activeTab === 'analysis'} on:click={() => activeTab = 'analysis'}>
                    📊 分析
                </button>
            </div>
            <div class="sidebar-content" class:optimization={activeTab === 'optimization'} class:analysis={activeTab === 'analysis'}>
                {#if activeTab === 'optimization'}
                    <div class="optimization-section card">
                        <OptimizationPanel />
                    </div>
                {:else}
                    <div class="analysis-section">
                        <AnalysisPanel />
                    </div>
                {/if}
            </div>
        </aside>
    </main>

    <footer class="app-footer">
        <div class="footer-chart card">
            <div class="chart-header">
                <span class="chart-title">能带结构</span>
            </div>
            <div class="chart-content">
                <BandStructureChart />
            </div>
        </div>
        <div class="footer-chart card">
            <div class="chart-header">
                <span class="chart-title">优化历史</span>
            </div>
            <div class="chart-content">
                <OptimizationHistoryChart />
            </div>
        </div>
        <div class="footer-chart card">
            <div class="chart-header">
                <span class="chart-title">参数敏感性</span>
            </div>
            <div class="chart-content">
                <SensitivityRadarChart />
            </div>
        </div>
    </footer>
</div>

<style>
    .app-layout {
        height: 100vh;
        display: grid;
        grid-template-rows: 52px 1fr 220px;
        gap: 8px;
        padding: 8px;
        background: var(--bg-primary);
    }

    .app-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 16px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .header-title h1 {
        font-size: 15px;
        font-weight: 600;
        background: linear-gradient(135deg, #3b82f6, #06b6d4);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .subtitle {
        font-size: 10px;
        color: var(--text-muted);
        letter-spacing: 1px;
    }

    .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--success);
    }

    .status-dot.active {
        background: var(--warning);
        animation: pulse 1.5s ease-in-out infinite;
    }

    .status-text {
        font-size: 12px;
        color: var(--text-muted);
    }

    .app-main {
        display: grid;
        grid-template-columns: 280px 1fr 300px;
        gap: 8px;
        min-height: 0;
    }

    .sidebar-left {
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--border-color) transparent;
    }

    .center-panel {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
    }

    .viewer-section {
        flex: 1;
        min-height: 0;
    }

    .actions-bar {
        display: flex;
        gap: 8px;
        justify-content: center;
    }

    .sidebar-right {
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--border-color) transparent;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .sidebar-tabs {
        display: flex;
        gap: 4px;
    }

    .tab-btn {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        background: var(--bg-card);
        border-radius: var(--radius);
        color: var(--text-muted);
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
    }

    .tab-btn:hover {
        border-color: var(--primary);
        color: var(--text-primary);
    }

    .tab-btn.active {
        background: var(--primary);
        border-color: var(--primary);
        color: white;
    }

    .sidebar-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    .analysis-section {
        height: 100%;
    }

    .optimization-section {
        height: 100%;
    }

    .app-footer {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
        min-height: 0;
    }

    .footer-chart {
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .chart-header {
        padding: 8px 12px;
        border-bottom: 1px solid var(--border-color);
    }

    .chart-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
    }

    .chart-content {
        flex: 1;
        min-height: 0;
    }
</style>
