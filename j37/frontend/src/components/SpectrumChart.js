import React, { useMemo, useRef, useEffect } from 'react';
import ReactEChartsCore, { echarts } from '../echartsSetup';

export default function SpectrumChart({ data, channelName = 'Channel' }) {
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
    if (!data || !data.freqs || data.freqs.length === 0) {
      return { title: { text: 'No Spectrum Data', left: 'center', textStyle: { color: '#aaa' } }, backgroundColor: '#1a1a2e' };
    }

    const maxPoints = 5000;
    const step = Math.max(1, Math.floor(data.freqs.length / maxPoints));
    const freqs = [];
    const psd = [];
    for (let i = 0; i < data.freqs.length; i += step) {
      freqs.push(Number(data.freqs[i]).toFixed(1));
      psd.push(data.psd[i]);
    }

    return {
      title: {
        text: `${channelName} Power Spectrum`,
        left: 'center',
        textStyle: { color: '#e0e0e0', fontSize: 14 },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          return `Freq: ${p.axisValue} Hz<br/>PSD: ${Number(p.value).toFixed(6)}`;
        },
      },
      toolbox: {
        feature: {
          dataZoom: { yAxisIndex: 'none' },
          restore: {},
          saveAsImage: {},
        },
        right: 10,
        top: 5,
      },
      grid: { left: 70, right: 30, top: 50, bottom: 80 },
      xAxis: {
        type: 'category',
        data: freqs,
        name: 'Frequency (Hz)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { color: '#aaa', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'PSD',
        axisLabel: { color: '#aaa' },
        splitLine: { lineStyle: { color: '#333' } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, bottom: 10 },
      ],
      series: [
        {
          name: 'PSD',
          type: 'line',
          data: psd,
          symbol: 'none',
          lineStyle: { width: 1, color: '#61ddaa' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(97,221,170,0.3)' },
              { offset: 1, color: 'rgba(97,221,170,0.02)' },
            ]),
          },
        },
      ],
      backgroundColor: '#1a1a2e',
    };
  }, [data, channelName]);

  return <ReactEChartsCore ref={chartRef} echarts={echarts} option={option} style={{ height: '100%', width: '100%' }} notMerge lazyUpdate />;
}
