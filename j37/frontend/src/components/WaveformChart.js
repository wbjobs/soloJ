import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import ReactEChartsCore, { echarts } from '../echartsSetup';

const MAX_RENDER_POINTS = 5000;

export default function WaveformChart({ data, onRegionSelect, channelName = 'Channel' }) {
  const chartRef = useRef(null);
  const prevDataRef = useRef(null);

  const sampled = useMemo(() => {
    if (!data || !data.values || data.values.length === 0) {
      return null;
    }
    const downsampleFactor = Math.max(1, Math.floor(data.values.length / MAX_RENDER_POINTS));
    const sampledValues = [];
    const sampledTimes = [];
    for (let i = 0; i < data.values.length; i += downsampleFactor) {
      sampledValues.push(data.values[i]);
      if (data.times && data.times[i] != null) {
        sampledTimes.push(data.times[i]);
      } else {
        sampledTimes.push(i);
      }
    }
    return { values: sampledValues, times: sampledTimes };
  }, [data]);

  useEffect(() => {
    return () => {
      const chart = chartRef.current?.getEchartsInstance?.();
      if (chart) {
        chart.clear();
        chart.dispose();
      }
      chartRef.current = null;
      prevDataRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      prevDataRef.current = null;
    };
  }, [data]);

  const option = useMemo(() => {
    if (!sampled) {
      return { title: { text: 'No Data', left: 'center', textStyle: { color: '#aaa' } }, backgroundColor: '#1a1a2e' };
    }

    return {
      title: {
        text: `${channelName} Waveform`,
        left: 'center',
        textStyle: { color: '#e0e0e0', fontSize: 14 },
      },
      tooltip: { trigger: 'axis' },
      toolbox: {
        feature: {
          dataZoom: { yAxisIndex: 'none' },
          restore: {},
          saveAsImage: {},
        },
        right: 10,
        top: 5,
      },
      grid: { left: 60, right: 30, top: 50, bottom: 80 },
      xAxis: {
        type: 'category',
        data: sampled.times,
        axisLabel: { color: '#aaa', fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#aaa' },
        splitLine: { lineStyle: { color: '#333' } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, bottom: 10 },
      ],
      series: [
        {
          name: channelName,
          type: 'line',
          data: sampled.values,
          symbol: 'none',
          lineStyle: { width: 1, color: '#5b8ff9' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(91,143,249,0.3)' },
              { offset: 1, color: 'rgba(91,143,249,0.02)' },
            ]),
          },
        },
      ],
      backgroundColor: '#1a1a2e',
    };
  }, [sampled, channelName]);

  const handleEvents = useCallback(
    (params) => {
      if (onRegionSelect && params.componentType === 'dataZoom') {
        const chart = chartRef.current?.getEchartsInstance?.();
        if (chart) {
          const opt = chart.getOption();
          const totalLen = data?.values?.length || 0;
          const startIdx = Math.floor((opt.dataZoom[0].start / 100) * totalLen);
          const endIdx = Math.floor((opt.dataZoom[0].end / 100) * totalLen);
          if (data?.times) {
            onRegionSelect({
              startTime: data.times[startIdx],
              endTime: data.times[endIdx],
            });
          }
        }
      }
    },
    [onRegionSelect, data]
  );

  return (
    <ReactEChartsCore
      ref={chartRef}
      echarts={echarts}
      option={option}
      style={{ height: '100%', width: '100%' }}
      onEvents={{ datazoom: handleEvents }}
      notMerge={true}
      lazyUpdate={true}
    />
  );
}
