<script>
    import { onMount, onDestroy } from 'svelte';
    import { bandStructureData, targetBandGap } from '../stores/params.js';

    let canvas;
    let ctx;
    let animFrameId;

    const PADDING = { top: 30, right: 30, bottom: 40, left: 60 };

    function drawBandStructure() {
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
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('频率 (Hz)', PADDING.left + plotW / 2, height - 6);

        ctx.save();
        ctx.translate(14, PADDING.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('波矢 k', 0, 0);
        ctx.restore();

        if (!$bandStructureData) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('等待计算...', PADDING.left + plotW / 2, PADDING.top + plotH / 2);
            return;
        }

        const eigenvalues = $bandStructureData.eigenvalues;
        const kPath = $bandStructureData.k_path;
        if (!eigenvalues || !kPath || eigenvalues.length === 0) return;

        const allFreqs = eigenvalues.flat().filter(f => isFinite(f));
        if (allFreqs.length === 0) return;

        const maxFreq = Math.min(Math.max(...allFreqs) * 1.1, 3000);
        const minFreq = 0;

        const targetStart = $targetBandGap.start;
        const targetEnd = $targetBandGap.end;

        const yTargetStart = PADDING.top + plotH - ((targetStart - minFreq) / (maxFreq - minFreq)) * plotH;
        const yTargetEnd = PADDING.top + plotH - ((targetEnd - minFreq) / (maxFreq - minFreq)) * plotH;

        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(PADDING.left, yTargetEnd, plotW, yTargetStart - yTargetEnd);

        ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(PADDING.left, yTargetStart);
        ctx.lineTo(PADDING.left + plotW, yTargetStart);
        ctx.moveTo(PADDING.left, yTargetEnd);
        ctx.lineTo(PADDING.left + plotW, yTargetEnd);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(59, 130, 246, 0.7)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`目标 ${targetStart}-${targetEnd} Hz`, PADDING.left + plotW - 4, yTargetEnd - 4);

        const numBands = Math.min(eigenvalues[0]?.length || 0, 10);
        const bandColors = [
            '#3b82f6', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b',
            '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
        ];

        for (let band = 0; band < numBands; band++) {
            ctx.strokeStyle = bandColors[band % bandColors.length];
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let k = 0; k < eigenvalues.length; k++) {
                const freq = eigenvalues[k][band];
                if (!isFinite(freq)) continue;

                const x = PADDING.left + (k / (eigenvalues.length - 1)) * plotW;
                const y = PADDING.top + plotH - ((freq - minFreq) / (maxFreq - minFreq)) * plotH;

                if (k === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        const numTicks = 5;
        for (let i = 0; i <= numTicks; i++) {
            const freq = minFreq + (maxFreq - minFreq) * i / numTicks;
            const y = PADDING.top + plotH - (i / numTicks) * plotH;

            ctx.strokeStyle = '#1e3a5f';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(PADDING.left - 4, y);
            ctx.lineTo(PADDING.left, y);
            ctx.stroke();

            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(freq).toString(), PADDING.left - 8, y + 3);
        }

        const kLabels = ['Γ', 'X', 'M', 'Γ'];
        const kPositions = [0, 0.33, 0.66, 1.0];
        for (let i = 0; i < kLabels.length; i++) {
            const x = PADDING.left + kPositions[i] * plotW;
            ctx.fillStyle = '#94a3b8';
            ctx.font = '12px serif';
            ctx.textAlign = 'center';
            ctx.fillText(kLabels[i], x, PADDING.top + plotH + 20);

            ctx.strokeStyle = '#2a3a5f';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(x, PADDING.top);
            ctx.lineTo(x, PADDING.top + plotH);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    onMount(() => {
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx = canvas.getContext('2d');
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx = canvas.getContext('2d');

        drawBandStructure();
    });

    $: if (ctx) {
        drawBandStructure();
    }

    onDestroy(() => {
        if (animFrameId) cancelAnimationFrame(animFrameId);
    });
</script>

<div class="band-structure-container">
    <canvas bind:this={canvas}></canvas>
</div>

<style>
    .band-structure-container {
        width: 100%;
        height: 100%;
        position: relative;
    }

    canvas {
        width: 100%;
        height: 100%;
    }
</style>
