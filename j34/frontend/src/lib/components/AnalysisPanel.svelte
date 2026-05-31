<script>
    import { targetBandGap, sensitivityData, sensitivityLoading, surrogateModelInfo, surrogateTrainingStatus } from '../stores/params.js';
    import { runSensitivityAnalysis, trainSurrogateModel, getSurrogateModelInfo } from '../services/api.js';
    import SensitivityRadarChart from './SensitivityRadarChart.svelte';

    async function handleAnalyze() {
        $sensitivityLoading = true;
        try {
            const result = await runSensitivityAnalysis(
                $targetBandGap.start,
                $targetBandGap.end,
                4096
            );
            $sensitivityData = result;
        } catch (error) {
            console.error('Sensitivity analysis failed:', error);
        } finally {
            $sensitivityLoading = false;
        }
    }

    async function handleTrainModel() {
        $surrogateTrainingStatus = 'training';
        try {
            const result = await trainSurrogateModel(2000, 150);
            $surrogateModelInfo = {
                is_trained: true,
                test_rmse: result.test_rmse,
                n_samples: result.n_train_samples
            };
        } catch (error) {
            console.error('Surrogate training failed:', error);
        } finally {
            $surrogateTrainingStatus = 'idle';
        }
    }

    async function handleRefreshInfo() {
        try {
            const info = await getSurrogateModelInfo();
            $surrogateModelInfo = info;
        } catch (error) {
            console.error('Failed to get model info:', error);
        }
    }
</script>

<div class="analysis-panel">
    <div class="panel-header">
        <h3>全局参数敏感性分析</h3>
        <span class="badge badge-info">Sobol指数</span>
    </div>

    <div class="model-info">
        <div class="info-row">
            <span class="info-label">代理模型状态:</span>
            {#if $surrogateModelInfo.is_trained}
                <span class="badge badge-success">已训练</span>
            {:else}
                <span class="badge badge-warning">未训练</span>
            {/if}
        </div>
        {#if $surrogateModelInfo.is_trained}
            <div class="info-row">
                <span class="info-label">测试集RMSE:</span>
                <span class="info-value">{$surrogateModelInfo.test_rmse?.toFixed(2) || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">训练样本数:</span>
                <span class="info-value">{$surrogateModelInfo.n_samples || 0}</span>
            </div>
        {/if}
    </div>

    <div class="model-actions">
        <button
            class="btn btn-secondary btn-sm"
            on:click={handleTrainModel}
            disabled={$surrogateTrainingStatus === 'training'}
        >
            {#if $surrogateTrainingStatus === 'training'}
                <span class="animate-spin">⟳</span>
                训练中...
            {:else}
                🧠 训练代理模型
            {/if}
        </button>
        <button
            class="btn btn-secondary btn-sm"
            on:click={handleRefreshInfo}
            disabled={$surrogateTrainingStatus === 'training'}
        >
            ↻ 刷新
        </button>
    </div>

    <div class="radar-wrapper">
        <SensitivityRadarChart
            sensitivityData={$sensitivityData}
            loading={$sensitivityLoading}
        />
    </div>

    <div class="analysis-actions">
        <button
            class="btn btn-primary btn-sm"
            on:click={handleAnalyze}
            disabled={$sensitivityLoading || $surrogateTrainingStatus === 'training'}
        >
            {#if $sensitivityLoading}
                <span class="animate-spin">⟳</span>
                分析中...
            {:else}
                📊 分析参数敏感性
            {/if}
        </button>
    </div>

    {#if $sensitivityData?.ranking}
        <div class="sensitivity-details">
            <div class="section-label">详细排名</div>
            <div class="ranking-table">
                {#each $sensitivityData.ranking as item}
                    <div class="ranking-row">
                        <span class="rank-badge">#{item.rank}</span>
                        <span class="rank-name">{item.param_name_cn}</span>
                        <div class="rank-bar">
                            <div
                                class="rank-bar-fill"
                                style="width: {item.contribution_pct}%;"
                            ></div>
                        </div>
                        <span class="rank-value">{item.contribution_pct.toFixed(0)}%</span>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .analysis-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .panel-header h3 {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .model-info {
        background: var(--bg-input);
        border-radius: var(--radius);
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
    }

    .info-label {
        color: var(--text-muted);
    }

    .info-value {
        color: var(--accent-secondary);
        font-family: monospace;
    }

    .model-actions {
        display: flex;
        gap: 6px;
    }

    .model-actions .btn {
        flex: 1;
    }

    .btn-sm {
        padding: 6px 12px;
        font-size: 12px;
    }

    .radar-wrapper {
        flex: 1;
        min-height: 220px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        overflow: hidden;
    }

    .analysis-actions {
        display: flex;
        justify-content: center;
    }

    .analysis-actions .btn {
        width: 100%;
    }

    .section-label {
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .sensitivity-details {
        margin-top: 8px;
    }

    .ranking-table {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .ranking-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
    }

    .rank-badge {
        width: 22px;
        font-weight: 700;
        color: var(--text-muted);
    }

    .rank-name {
        width: 80px;
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .rank-bar {
        flex: 1;
        height: 6px;
        background: var(--bg-input);
        border-radius: 3px;
        overflow: hidden;
    }

    .rank-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
        border-radius: 3px;
        transition: width 0.5s ease;
    }

    .rank-value {
        width: 36px;
        text-align: right;
        color: var(--accent-secondary);
        font-family: monospace;
        font-weight: 600;
    }
</style>
