<script>
    import { onMount, onDestroy } from 'svelte';

    export let sensitivityData = null;
    export let loading = false;

    let canvas;
    let ctx;
    let animFrame;

    const COLORS = {
        first_order: '#3b82f6',
        total_order: '#06b6d4',
        grid: '#1e3a5f',
        text: '#94a3b8',
        highlight: '#8b5cf6'
    };

    function drawRadarChart() {
        if (!canvas || !ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 50;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#0f1729';
        ctx.fillRect(0, 0, width, height);

        if (!sensitivityData || !sensitivityData.first_order) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                loading ? '计算中...' : '点击"分析参数敏感性"开始',
                centerX, centerY
            );
            return;
        }

        const labels = sensitivityData.param_names_cn || sensitivityData.param_names;
        const firstOrder = sensitivityData.first_order;
        const totalOrder = sensitivityData.total_order;
        const nVars = labels.length;

        const maxVal = Math.max(...firstOrder, ...totalOrder, 0.01);

        for (let level = 1; level <= 5; level++) {
            const r = (level / 5) * radius;
            ctx.strokeStyle = COLORS.grid;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            for (let i = 0; i <= nVars; i++) {
                const angle = (i / nVars) * Math.PI * 2 - Math.PI / 2;
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();

            ctx.fillStyle = '#475569';
            ctx.font = '9px monospace';
            ctx.textAlign = 'left';
            const val = (level / 5 * maxVal).toFixed(2);
            ctx.fillText(val, centerX + r + 4, centerY + 3);
        }

        for (let i = 0; i < nVars; i++) {
            const angle = (i / nVars) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + Math.cos(angle) * (radius + 30);
            const y = centerY + Math.sin(angle) * (radius + 30);

            ctx.strokeStyle = '#2a3a5f';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = COLORS.text;
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const label = labels[i];
            const st = totalOrder[i];
            const isTop3 = st > 0.15;

            if (isTop3) {
                ctx.fillStyle = COLORS.highlight;
                ctx.font = 'bold 11px Inter, sans-serif';
            }

            ctx.fillText(label, x, y);

            if (isTop3) {
                ctx.font = 'bold 9px monospace';
                ctx.fillStyle = COLORS.highlight;
                ctx.fillText(`ST=${st.toFixed(2)}`, x, y + 12);
            }
        }

        drawDataSeries(firstOrder, centerX, centerY, radius, maxVal, COLORS.first_order, 0.3, 1.5);
        drawDataSeries(totalOrder, centerX, centerY, radius, maxVal, COLORS.total_order, 0.15, 2);

        drawLegend(centerX, height - 20);

        if (sensitivityData.ranking) {
            drawRanking(sensitivityData.ranking, 10, 10);
        }
    }

    function drawDataSeries(data, cx, cy, radius, maxVal, color, fillAlpha, lineWidth) {
        const nVars = data.length;

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.fillStyle = color + Math.floor(fillAlpha * 255).toString(16).padStart(2, '0');

        ctx.beginPath();
        for (let i = 0; i <= nVars; i++) {
            const idx = i % nVars;
            const angle = (idx / nVars) * Math.PI * 2 - Math.PI / 2;
            const r = (data[idx] / maxVal) * radius;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        for (let i = 0; i < nVars; i++) {
            const angle = (i / nVars) * Math.PI * 2 - Math.PI / 2;
            const r = (data[i] / maxVal) * radius;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawLegend(cx, y) {
        const items = [
            { label: '一阶Sobol (S1)', color: COLORS.first_order },
            { label: '总Sobol (ST)', color: COLORS.total_order }
        ];

        const itemWidth = 120;
        const startX = cx - itemWidth * items.length / 2;

        items.forEach((item, i) => {
            const x = startX + i * itemWidth;

            ctx.fillStyle = item.color;
            ctx.fillRect(x, y - 8, 16, 3);

            ctx.fillStyle = COLORS.text;
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.label, x + 22, y);
        });
    }

    function drawRanking(ranking, x, y) {
        const top3 = ranking.slice(0, 3);

        ctx.fillStyle = 'rgba(10, 14, 26, 0.8)';
        ctx.fillRect(x, y, 180, 90);
        ctx.strokeStyle = '#1e3a5f';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 180, 90);

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('参数重要性排名', x + 10, y + 18);

        top3.forEach((item, i) => {
            const yPos = y + 38 + i * 22;

            ctx.fillStyle = ['#fbbf24', '#94a3b8', '#a16207'][i];
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.fillText(`#${i + 1}`, x + 10, yPos);

            ctx.fillStyle = '#e2e8f0';
            ctx.font = '11px Inter, sans-serif';
            ctx.fillText(item.param_name_cn, x + 40, yPos);

            ctx.fillStyle = '#06b6d4';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${item.contribution_pct.toFixed(0)}%`, x + 170, yPos);
        });
    }

    function resize() {
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx = canvas.getContext('2d');
        drawRadarChart();
    }

    $: if (ctx) drawRadarChart();

    onMount(() => {
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    });

    onDestroy(() => {
        if (animFrame) cancelAnimationFrame(animFrame);
        window.removeEventListener('resize', resize);
    });
</script>

<div class="radar-container">
    <canvas bind:this={canvas}></canvas>
    {#if loading}
        <div class="loading-overlay">
            <span class="animate-spin" style="font-size: 24px;">⟳</span>
            <span class="loading-text">Sobol敏感性分析中...</span>
            <span class="loading-subtext">分析 {sensitivityData?.sample_count || 4096} 个样本</span>
        </div>
    {/if}
</div>

<style>
    .radar-container {
        position: relative;
        width: 100%;
        height: 100%;
    }

    canvas {
        width: 100%;
        height: 100%;
    }

    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(10, 14, 26, 0.85);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        backdrop-filter: blur(4px);
    }

    .loading-text {
        font-size: 14px;
        color: var(--text-secondary);
        font-weight: 500;
    }

    .loading-subtext {
        font-size: 11px;
        color: var(--text-muted);
    }
</style>
