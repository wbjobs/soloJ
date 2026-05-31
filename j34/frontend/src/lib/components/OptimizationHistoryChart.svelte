<script>
    import { onMount, onDestroy } from 'svelte';
    import { optimizationHistory, optimizationConfig } from '../stores/params.js';

    let canvas;
    let ctx;

    const PADDING = { top: 20, right: 20, bottom: 30, left: 50 };

    function drawHistory() {
        if (!canvas || !ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const plotW = width - PADDING.left - PADDING.right;
        const plotH = height - PADDING.top - PADDING.bottom;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#0f1729';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#1e3a5f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PADDING.left, PADDING.top);
        ctx.lineTo(PADDING.left, PADDING.top + plotH);
        ctx.lineTo(PADDING.left + plotW, PADDING.top + plotH);
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('迭代次数', PADDING.left + plotW / 2, height - 4);

        ctx.save();
        ctx.translate(10, PADDING.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('目标函数值', 0, 0);
        ctx.restore();

        if (!$optimizationHistory || $optimizationHistory.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '13px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('等待优化数据...', PADDING.left + plotW / 2, PADDING.top + plotH / 2);
            return;
        }

        const scores = $optimizationHistory.map(h => h.objective_score);
        const maxScore = Math.max(...scores) * 1.1;
        const minScore = Math.min(0, Math.min(...scores) * 0.9);

        const gradient = ctx.createLinearGradient(PADDING.left, 0, PADDING.left + plotW, 0);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0.1)');

        ctx.beginPath();
        for (let i = 0; i < scores.length; i++) {
            const x = PADDING.left + (i / Math.max(scores.length - 1, 1)) * plotW;
            const y = PADDING.top + plotH - ((scores[i] - minScore) / (maxScore - minScore)) * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        const lastX = PADDING.left + plotW;
        ctx.lineTo(lastX, PADDING.top + plotH);
        ctx.lineTo(PADDING.left, PADDING.top + plotH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < scores.length; i++) {
            const x = PADDING.left + (i / Math.max(scores.length - 1, 1)) * plotW;
            const y = PADDING.top + plotH - ((scores[i] - minScore) / (maxScore - minScore)) * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (scores.length > 0) {
            const bestIdx = scores.indexOf(Math.min(...scores));
            const bx = PADDING.left + (bestIdx / Math.max(scores.length - 1, 1)) * plotW;
            const by = PADDING.top + plotH - ((scores[bestIdx] - minScore) / (maxScore - minScore)) * plotH;

            ctx.beginPath();
            ctx.arc(bx, by, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#10b981';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`最优: ${scores[bestIdx].toFixed(2)}`, bx + 8, by - 4);
        }

        const numTicks = 4;
        for (let i = 0; i <= numTicks; i++) {
            const val = minScore + (maxScore - minScore) * i / numTicks;
            const y = PADDING.top + plotH - (i / numTicks) * plotH;

            ctx.fillStyle = '#64748b';
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(val.toFixed(0), PADDING.left - 6, y + 3);
        }
    }

    onMount(() => {
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx = canvas.getContext('2d');
        drawHistory();
    });

    $: if (ctx) {
        drawHistory();
    }
</script>

<div class="history-chart-container">
    <canvas bind:this={canvas}></canvas>
</div>

<style>
    .history-chart-container {
        width: 100%;
        height: 100%;
    }

    canvas {
        width: 100%;
        height: 100%;
    }
</style>
