import React, { useMemo, useRef, useEffect } from 'react';
import ReactEChartsCore, { echarts } from '../echartsSetup';

export default function FeatureDeltaChart({ deltas }) {
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
    if (!deltas || Object.keys(deltas).length === 0) {
      return { title: { text: 'No Comparison Data', left: 'center', textStyle: { color: '#aaa' } }, backgroundColor: '#1a1a2e' };
    }

    const keys = Object.keys(deltas);
    const values = Object.values(deltas);

    return {
      title: {
        text: 'Feature Deviation from Baseline',
        left: 'center',
        textStyle: { color: '#e0e0e0', fontSize: 14 },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          return `${p.name}: ${(p.value * 100).toFixed(1)}%`;
        },
      },
      grid: { left: 120, right: 30, top: 50, bottom: 30 },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#aaa',
          formatter: (v) => `${(v * 100).toFixed(0)}%`,
        },
        splitLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'category',
        data: keys,
        axisLabel: { color: '#aaa', fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v) => ({
            value: v,
            itemStyle: {
              color: v >= 0 ? '#f5222d' : '#52c41a',
            },
          })),
          barWidth: '60%',
          label: {
            show: true,
            position: 'right',
            formatter: (p) => `${(p.value * 100).toFixed(1)}%`,
            color: '#e0e0e0',
            fontSize: 11,
          },
        },
      ],
      backgroundColor: '#1a1a2e',
    };
  }, [deltas]);

  return <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />;
}
