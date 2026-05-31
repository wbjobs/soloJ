import React, { useRef, useEffect } from 'react';
import { Peak } from '../wasm/fingerprint_wasm';

interface Props {
    peaks: Peak[];
    frameSize: number;
    sampleRate: number;
    hopSize: number;
    width?: number;
    height?: number;
}

export const FingerprintVisualizer: React.FC<Props> = ({
    peaks,
    frameSize,
    sampleRate,
    hopSize,
    width = 800,
    height = 300,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;

        for (let i = 0; i <= 10; i++) {
            const y = (height / 10) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        if (peaks.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无峰值数据', width / 2, height / 2);
            return;
        }

        const maxFrame = Math.max(...peaks.map(p => p.frame), 1);
        const maxBin = frameSize / 2;

        ctx.fillStyle = '#22d3ee';

        for (const peak of peaks) {
            const x = (peak.frame / maxFrame) * width;
            const y = height - (peak.bin / maxBin) * height;
            const mag = Math.min(peak.magnitude / 50, 1);
            const radius = 1 + mag * 3;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(34, 211, 238, 0.3)');
        gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.fillStyle = gradient;

        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText('0 Hz', 5, height - 5);
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.floor(sampleRate / 2000)} kHz`, width - 5, 15);

        const duration = ((maxFrame * hopSize) / sampleRate).toFixed(2);
        ctx.textAlign = 'right';
        ctx.fillText(`${duration}s`, width - 5, height - 5);

    }, [peaks, frameSize, sampleRate, hopSize, width, height]);

    return (
        <div style={{ position: 'relative' }}>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    display: 'block',
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: 'rgba(15, 23, 42, 0.8)',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#94a3b8',
                }}
            >
                峰值数: {peaks.length}
            </div>
        </div>
    );
};
