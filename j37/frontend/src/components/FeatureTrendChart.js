import React, { useMemo, useRef, useEffect } from 'react';
import ReactEChartsCore, { echarts } from '../echartsSetup';

export default function FeatureTrendChart({ features }) {
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
    if (!features || features.length === 0) {
      return { title: { text: 'No Feature Data', left: 'center', textStyle: { color: '#aaa' } }, backgroundColor: '#1a1a2e' };
    }

    const maxPoints = 500;
    const step = Math.max(1, Math.floor(features.length / maxPoints));
    const downsampled = [];
    for (let i = 0; i < features.length; i += step) {
      downsampled.push(features[i]);
    }

    const timestamps = downsampled.map((f) => f.timestamp);
    const featureKeys = Object.keys(downsampled[0]).filter(
      (k) => k !== 'timestamp' && k !== 'mse_values' && typeof downsampled[0][k] === 'number'
    );

    const series = featureKeys.map((key) => ({
      name: key,
      type: 'line',
      data: downsampled.map((f) => f[key]),
      symbol: 'circle',
      symbolSize: 3,
      lineStyle: { width: 1.5 },
    }));

    const colors = [
      '#5b8ff9', '#61ddaa', '#f6bd16', '#7262fd', '#78d3f8',
      '#9661bc', '#f6903d', '#008685', '#f08b51', '#e8684a',
    ];

    return {
      title: {
        text: 'Feature Trend Over Time',
        left: 'center',
        textStyle: { color: '#e0e0e0', fontSize: 14 },
      },
      tooltip: { trigger: 'axis' },
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: { color: '#aaa', fontSize: 10 },
        pageTextStyle: { color: '#aaa' },
      },
      grid: { left: 60, right: 30, top: 50, bottom: 80 },
      color: colors,
      xAxis: {
        type: 'category',
        data: timestamps.map((t) => {
          try {
            return new Date(t).toLocaleTimeString();
          } catch {
            return t;
          }
        }),
        axisLabel: { color: '#aaa', fontSize: 9, rotate: 30 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#aaa' },
        splitLine: { lineStyle: { color: '#333' } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, bottom: 30 },
      ],
      series,
      backgroundColor: '#1a1a2e',
    };
  }, [features]);

  return <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />;
}
