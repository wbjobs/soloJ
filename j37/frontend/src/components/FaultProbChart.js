import React, { useMemo, useRef, useEffect } from 'react';
import ReactEChartsCore, { echarts } from '../echartsSetup';

export default function FaultProbChart({ probabilities }) {
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
    if (!probabilities) {
      return { title: { text: 'No Diagnosis Data', left: 'center', textStyle: { color: '#aaa' } }, backgroundColor: '#1a1a2e' };
    }

    const labels = Object.keys(probabilities);
    const values = Object.values(probabilities);

    const colorMap = {
      normal: '#52c41a',
      bearing_inner: '#f5222d',
      bearing_outer: '#fa541c',
      bearing_ball: '#fa8c16',
      gear_wear: '#eb2f96',
      misalignment: '#722ed1',
    };

    return {
      title: {
        text: 'Fault Type Probability',
        left: 'center',
        textStyle: { color: '#e0e0e0', fontSize: 14 },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const p = params[0];
          return `${p.name}: ${(p.value * 100).toFixed(2)}%`;
        },
      },
      grid: { left: 100, right: 30, top: 50, bottom: 30 },
      xAxis: {
        type: 'value',
        max: 1,
        axisLabel: {
          color: '#aaa',
          formatter: (v) => `${(v * 100).toFixed(0)}%`,
        },
        splitLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#aaa', fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colorMap[labels[i]] || '#5b8ff9' },
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
  }, [probabilities]);

  return <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />;
}
