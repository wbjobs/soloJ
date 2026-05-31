<script>
    import {
        targetBandGap, optimizationConfig, optimizationStatus,
        optimizationJobId, bestResult, optimizationHistory
    } from '../stores/params.js';
    import { startOptimization, getOptimizationStatus, getOptimizationHistory } from '../services/api.js';

    let pollInterval;

    $: statusText = {
        idle: '就绪',
        queued: '排队中',
        running: '优化中...',
        completed: '已完成',
        failed: '失败'
    }[$optimizationStatus] || '未知';

    $: statusBadgeClass = {
        idle: 'badge-info',
        queued: 'badge-warning',
        running: 'badge-warning',
        completed: 'badge-success',
        failed: 'badge-error'
    }[$optimizationStatus] || 'badge-info';

    async function handleStartOptimization() {
        try {
            $optimizationStatus = 'queued';
            const result = await startOptimization(
                $targetBandGap.start,
                $targetBandGap.end,
                $optimizationConfig.budget,
                $optimizationConfig.num_workers
            );

            if (result.success) {
                $optimizationJobId = result.job_id;
                $optimizationStatus = 'running';
                startPolling(result.job_id);
            } else {
                $optimizationStatus = 'failed';
            }
        } catch (error) {
            console.error('Optimization failed:', error);
            $optimizationStatus = 'failed';
        }
    }

    function startPolling(jobId) {
        if (pollInterval) clearInterval(pollInterval);

        pollInterval = setInterval(async () => {
            try {
                const history = await getOptimizationHistory(jobId);

                if (history.history && history.history.length > 0) {
                    $optimizationHistory = history.history;
                }

                if (history.best_params) {
                    $bestResult = {
                        params: history.best_params,
                        band_gaps: history.best_band_gaps
                    };
                }

                const status = await getOptimizationStatus(jobId);
                if (status.rq_status === 'finished') {
                    $optimizationStatus = 'completed';
                    clearInterval(pollInterval);
                } else if (status.rq_status === 'failed') {
                    $optimizationStatus = 'failed';
                    clearInterval(pollInterval);
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 3000);
    }

    function handleReset() {
        if (pollInterval) clearInterval(pollInterval);
        $optimizationStatus = 'idle';
        $optimizationJobId = null;
        $bestResult = null;
        $optimizationHistory = [];
    }

    $: progress = $optimizationHistory.length > 0 && $optimizationConfig.budget > 0
        ? Math.min(($optimizationHistory.length / $optimizationConfig.budget) * 100, 100)
        : 0;
</script>

<div class="optimization-panel">
    <div class="panel-header">
        <h3>优化控制</h3>
        <span class="badge {statusBadgeClass}">{statusText}</span>
    </div>

    <div class="target-section">
        <div class="section-label">目标带隙频率范围 (Hz)</div>
        <div class="freq-inputs">
            <div class="input-group">
                <label>起始频率</label>
                <input
                    type="number"
                    bind:value={$targetBandGap.start}
                    min="100"
                    max="5000"
                    step="10"
                />
            </div>
            <span class="freq-separator">—</span>
            <div class="input-group">
                <label>结束频率</label>
                <input
                    type="number"
                    bind:value={$targetBandGap.end}
                    min="100"
                    max="5000"
                    step="10"
                />
            </div>
        </div>
    </div>

    <div class="config-section">
        <div class="slider-container">
            <div class="slider-label">
                <span>优化迭代次数</span>
                <span class="slider-value">{$optimizationConfig.budget}</span>
            </div>
            <input
                type="range"
                min="20"
                max="200"
                step="10"
                bind:value={$optimizationConfig.budget}
            />
        </div>
        <div class="slider-container">
            <div class="slider-label">
                <span>并行工作数</span>
                <span class="slider-value">{$optimizationConfig.num_workers}</span>
            </div>
            <input
                type="range"
                min="1"
                max="8"
                step="1"
                bind:value={$optimizationConfig.num_workers}
            />
        </div>
    </div>

    {#if $optimizationStatus === 'running' || $optimizationStatus === 'queued'}
        <div class="progress-section">
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: {progress}%"></div>
            </div>
            <div class="progress-text">
                迭代: {$optimizationHistory.length} / {$optimizationConfig.budget}
            </div>
        </div>
    {/if}

    <div class="actions">
        <button
            class="btn btn-primary"
            on:click={handleStartOptimization}
            disabled={$optimizationStatus === 'running' || $optimizationStatus === 'queued'}
        >
            {#if $optimizationStatus === 'running' || $optimizationStatus === 'queued'}
                <span class="animate-spin">⟳</span>
                优化进行中
            {:else}
                ▶ 开始优化
            {/if}
        </button>
        <button class="btn btn-secondary" on:click={handleReset}>
            重置
        </button>
    </div>

    {#if $bestResult}
        <div class="result-section">
            <div class="section-label">最优结果</div>
            <div class="result-params">
                {#each Object.entries($bestResult.params) as [key, value]}
                    <div class="result-param">
                        <span class="param-key">{key}</span>
                        <span class="param-val">
                            {typeof value === 'number' ? value.toPrecision(4) : value}
                        </span>
                    </div>
                {/each}
            </div>
            {#if $bestResult.band_gaps && $bestResult.band_gaps.length > 0}
                <div class="band-gap-results">
                    <div class="section-label">发现的带隙</div>
                    {#each $bestResult.band_gaps as gap, i}
                        <div class="gap-item">
                            <span class="badge badge-success">带隙 {i + 1}</span>
                            <span>{Math.round(gap.start)} - {Math.round(gap.end)} Hz</span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .optimization-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
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

    .section-label {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 8px;
    }

    .freq-inputs {
        display: flex;
        align-items: flex-end;
        gap: 8px;
    }

    .input-group {
        flex: 1;
    }

    .input-group label {
        display: block;
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 4px;
    }

    .freq-separator {
        color: var(--text-muted);
        padding-bottom: 8px;
    }

    .progress-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .progress-bar-container {
        height: 6px;
        background: var(--bg-input);
        border-radius: 3px;
        overflow: hidden;
    }

    .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
        border-radius: 3px;
        transition: width 0.5s ease;
    }

    .progress-text {
        font-size: 11px;
        color: var(--text-muted);
        text-align: center;
    }

    .actions {
        display: flex;
        gap: 8px;
    }

    .actions .btn {
        flex: 1;
    }

    .result-section {
        background: var(--bg-input);
        border-radius: var(--radius);
        padding: 12px;
    }

    .result-params {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 12px;
    }

    .result-param {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
    }

    .param-key {
        color: var(--text-muted);
    }

    .param-val {
        color: var(--accent-secondary);
        font-family: monospace;
    }

    .band-gap-results {
        margin-top: 12px;
    }

    .gap-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--text-primary);
        padding: 4px 0;
    }
</style>
