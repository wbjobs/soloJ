import React, { useMemo, useRef, useEffect } from 'react';
import ReactEChartsCore, { echarts } from '../echartsSetup';

const MAX_TIME_POINTS = 500;
const MAX_SCALE_POINTS = 128;

export default function TimeFreqChart({ data, channelName = 'Channel' }) {
  const chartRef = useRef(null);

  useEffect(() => {
    return () => {
      const chart = chartRef.current?.getEchartsInstance?.();
      if (chart) {
        chart.clear();
        chart.dispose();
      }
      chartRef.current = null;
    };
  }, []);

  const option = useMemo(() => {
    if (!data || !data.coeffs || data.coeffs.length === 0) {
      return { title: { text: 'No CWT Data', left: 'center', textStyle: { color: '#aaa' } }, backgroundColor: '#1a1a2e' };
    }

    const coeffs = data.coeffs;
    const times = data.times || [];
    const freqs = data.freqs || [];
    const scales = data.scales || [];

    const downsampleTime = Math.max(1, Math.floor(times.length / MAX_TIME_POINTS));
    const downsampleScale = Math.max(1, Math.floor(scales.length / MAX_SCALE_POINTS));

    const sampledTimes = [];
    for (let i = 0; i < times.length; i += downsampleTime) {
      sampledTimes.push(times[i]);
    }
    const sampledFreqs = [];
    const sampledScaleIndices = [];
    for (let i = 0; i < scales.length; i += downsampleScale) {
      sampledFreqs.push(freqs[i]);
      sampledScaleIndices.push(i);
    }

    const sampledTimesFormatted = sampledTimes.map((t) => Number(t).toFixed(3));
    const sampledFreqsFormatted = sampledFreqs.map((f) => Number(f).toFixed(0));

    const heatmapData = [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let si = 0; si < sampledScaleIndices.length; si++) {
      const scaleIdx = sampledScaleIndices[si];
      if (scaleIdx >= coeffs.length) break;
      const row = coeffs[scaleIdx];
      for (let ti = 0; ti < sampledTimes.length; ti++) {
        const timeIdx = ti * downsampleTime;
        if (timeIdx >= row.length) break;
        const val = Math.abs(row[timeIdx]);
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
        heatmapData.push([ti, si, val]);
      }
    }

    if (!isFinite(minVal)) minVal = 0;
    if (!isFinite(maxVal)) maxVal = 1;

    return {
      title: {
        text: `${channelName} Time-Frequency (CWT)`,
        left: 'center',
        textStyle: { color: '#e0e0e0', fontSize: 14 },
      },
      tooltip: {
        formatter: (params) => {
          const tIdx = params.data[0];
          const sIdx = params.data[1];
          const val = params.data[2];
          return `Time: ${sampledTimes[tIdx]?.toFixed(4)}s<br/>Freq: ${Number(sampledFreqs[sIdx]).toFixed(1)} Hz<br/>|Coeff|: ${val.toFixed(4)}`;
        },
      },
      grid: { left: 80, right: 80, top: 50, bottom: 60 },
      xAxis: {
        type: 'category',
        data: sampledTimesFormatted,
        name: 'Time (s)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { color: '#aaa', fontSize: 9, interval: Math.floor(sampledTimesFormatted.length / 6) },
      },
      yAxis: {
        type: 'category',
        data: sampledFreqsFormatted,
        name: 'Frequency (Hz)',
        axisLabel: { color: '#aaa', fontSize: 9 },
      },
      visualMap: {
        min: minVal,
        max: maxVal,
        calculable: true,
        orient: 'vertical',
        right: 10,
        top: 'center',
        inRange: {
          color: ['#0d0887', '#4903a0', '#7d03a8', '#b93289', '#db5c68', '#f48849', '#febd2a', '#f0f921'],
        },
        textStyle: { color: '#aaa' },
      },
      series: [
        {
          type: 'heatmap',
          data: heatmapData,
          progressive: 5000,
          animation: false,
        },
      ],
      backgroundColor: '#1a1a2e',
    };
  }, [data, channelName]);

  return <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />;
}
