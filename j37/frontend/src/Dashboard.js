import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Layout,
  Select,
  DatePicker,
  Button,
  Tabs,
  Card,
  Row,
  Col,
  Space,
  message,
  Spin,
  Alert,
  Divider,
} from 'antd';
import { PlayCircleOutlined, SearchOutlined, ThunderboltOutlined, ApiOutlined, ExperimentOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import WaveformChart from './components/WaveformChart';
import SpectrumChart from './components/SpectrumChart';
import TimeFreqChart from './components/TimeFreqChart';
import FaultProbChart from './components/FaultProbChart';
import FeatureTrendChart from './components/FeatureTrendChart';
import DiagnosticTable from './components/DiagnosticTable';
import FeatureDeltaChart from './components/FeatureDeltaChart';
import CausalNetworkChart from './components/CausalNetworkChart';
import LabelingPanel from './components/LabelingPanel';
import ModelManager from './components/ModelManager';
import {
  getWaveform,
  getSpectrum,
  getCWT,
  getFeatures,
  getDiagnostics,
  compareRegion,
  trainModel,
  causalInference,
} from './api';

const { Header, Content } = Layout;
const { RangePicker } = DatePicker;

const CHANNELS = Array.from({ length: 24 }, (_, i) => `ch_${i}`);

export default function Dashboard() {
  const [sensorId, setSensorId] = useState('sensor-001');
  const [selectedChannel, setSelectedChannel] = useState('ch_0');
  const [timeRange, setTimeRange] = useState([
    dayjs().subtract(1, 'hour'),
    dayjs(),
  ]);

  const [waveformData, setWaveformData] = useState(null);
  const [spectrumData, setSpectrumData] = useState(null);
  const [cwtData, setCwtData] = useState(null);
  const [featureData, setFeatureData] = useState(null);
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [regionCompareData, setRegionCompareData] = useState(null);
  const [causalData, setCausalData] = useState(null);
  const [selectedCausalChannels, setSelectedCausalChannels] = useState(['ch_0', 'ch_1', 'ch_2', 'ch_3', 'ch_4', 'ch_5']);

  const [loading, setLoading] = useState({});
  const [regionRange, setRegionRange] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      setWaveformData(null);
      setSpectrumData(null);
      setCwtData(null);
      setFeatureData(null);
      setDiagnosticData(null);
      setRegionCompareData(null);
      setCausalData(null);
    };
  }, []);

  const withLoading = useCallback(async (key, fn) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await fn();
      return result;
    } catch (err) {
      message.error(`${key} failed: ${err.message}`);
      return null;
    } finally {
      if (mountedRef.current) {
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
    }
  }, []);

  const fetchWaveform = useCallback(async () => {
    setWaveformData(null);
    const result = await withLoading('waveform', async () => {
      const { data } = await getWaveform({
        sensor_id: sensorId,
        start_time: timeRange[0].toISOString(),
        end_time: timeRange[1].toISOString(),
        channel: selectedChannel,
      });
      return data;
    });
    if (result && mountedRef.current) setWaveformData(result);
  }, [sensorId, timeRange, selectedChannel, withLoading]);

  const fetchSpectrum = useCallback(async () => {
    setSpectrumData(null);
    const result = await withLoading('spectrum', async () => {
      const { data } = await getSpectrum({
        sensor_id: sensorId,
        start_time: timeRange[0].toISOString(),
        end_time: timeRange[1].toISOString(),
        channel: selectedChannel,
      });
      return data;
    });
    if (result && mountedRef.current) setSpectrumData(result);
  }, [sensorId, timeRange, selectedChannel, withLoading]);

  const fetchCWT = useCallback(async () => {
    setCwtData(null);
    const result = await withLoading('cwt', async () => {
      const { data } = await getCWT({
        sensor_id: sensorId,
        start_time: timeRange[0].toISOString(),
        end_time: timeRange[1].toISOString(),
        channel: selectedChannel,
      });
      return data;
    });
    if (result && mountedRef.current) setCwtData(result);
  }, [sensorId, timeRange, selectedChannel, withLoading]);

  const fetchFeatures = useCallback(async () => {
    setFeatureData(null);
    const result = await withLoading('features', async () => {
      const { data } = await getFeatures({
        sensor_id: sensorId,
        start_time: timeRange[0].toISOString(),
        end_time: timeRange[1].toISOString(),
        channel: selectedChannel,
      });
      return data;
    });
    if (result && mountedRef.current) setFeatureData(result.features);
  }, [sensorId, timeRange, selectedChannel, withLoading]);

  const fetchDiagnostics = useCallback(async () => {
    setDiagnosticData(null);
    const result = await withLoading('diagnostics', async () => {
      const { data } = await getDiagnostics({
        sensor_id: sensorId,
        start_time: timeRange[0].toISOString(),
        end_time: timeRange[1].toISOString(),
      });
      return data;
    });
    if (result && mountedRef.current) setDiagnosticData(result.diagnostics);
  }, [sensorId, timeRange, withLoading]);

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchWaveform(),
      fetchSpectrum(),
      fetchCWT(),
      fetchFeatures(),
      fetchDiagnostics(),
    ]);
  }, [fetchWaveform, fetchSpectrum, fetchCWT, fetchFeatures, fetchDiagnostics]);

  const mainTabs = [
    {
      key: 'analysis',
      label: '信号分析',
      children: (
        <Row gutter={[16, 16]}>
          <Col span={16}>
            <Card
              size="small"
              style={{ background: '#1a1a2e', borderColor: '#2a2a4a' }}
              bodyStyle={{ padding: 8 }}
            >
              <Tabs items={chartItems} />
            </Card>

            {regionRange && (
              <Alert
                style={{ marginTop: 8, background: '#1a1a2e', borderColor: '#5b8ff9' }}
                message={
                  <span style={{ color: '#e0e0e0' }}>
                    Region selected: {regionRange.startTime} ~ {regionRange.endTime}
                    <Button
                      type="link"
                      size="small"
                      onClick={handleRegionCompare}
                      loading={!!loading.compare}
                    >
                      Compare with Baseline
                    </Button>
                  </span>
                }
                type="info"
              />
            )}
          </Col>

          <Col span={8}>
            <Card
              title={<span style={{ color: '#e0e0e0' }}>Fault Diagnosis</span>}
              size="small"
              style={{ background: '#1a1a2e', borderColor: '#2a2a4a', marginBottom: 16 }}
              headStyle={{ background: '#16162e', borderColor: '#2a2a4a' }}
            >
              <div style={{ height: 300 }}>
                <FaultProbChart
                  probabilities={regionCompareData?.fault_probabilities}
                />
              </div>
            </Card>

            <Card
              title={<span style={{ color: '#e0e0e0' }}>Feature Deviation</span>}
              size="small"
              style={{ background: '#1a1a2e', borderColor: '#2a2a4a', marginBottom: 16 }}
              headStyle={{ background: '#16162e', borderColor: '#2a2a4a' }}
            >
              <div style={{ height: 280 }}>
                <FeatureDeltaChart deltas={regionCompareData?.feature_deltas} />
              </div>
              {regionCompareData?.overall_deviation != null && (
                <div style={{ color: '#e0e0e0', textAlign: 'center', marginTop: 4 }}>
                  Overall Deviation:{' '}
                  <span
                    style={{
                      color:
                        regionCompareData.overall_deviation > 0.5
                          ? '#f5222d'
                          : regionCompareData.overall_deviation > 0.2
                          ? '#fa8c16'
                          : '#52c41a',
                      fontWeight: 'bold',
                    }}
                  >
                    {(regionCompareData.overall_deviation * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'causal',
      label: (
        <span>
          <ApiOutlined /> 因果网络
        </span>
      ),
      children: (
        <div>
          <Card
            size="small"
            style={{ background: '#1a1a2e', borderColor: '#2a2a4a', marginBottom: 16 }}
            bodyStyle={{ padding: 16 }}
            title={
              <Space>
                <span style={{ color: '#e0e0e0' }}>振动信号因果网络推断</span>
                <Select
                  mode="multiple"
                  value={selectedCausalChannels}
                  onChange={setSelectedCausalChannels}
                  style={{ minWidth: 300 }}
                  size="small"
                  options={CHANNELS.map(ch => ({ value: ch, label: ch }))}
                />
                <Button
                  type="primary"
                  size="small"
                  onClick={fetchCausal}
                  loading={!!loading.causal}
                >
                  推断因果网络
                </Button>
              </Space>
            }
            headStyle={{ background: '#16162e', borderColor: '#2a2a4a' }}
          >
            <Spin spinning={!!loading.causal}>
              <div style={{ minHeight: 450, position: 'relative' }}>
                {causalData ? (
                  <CausalNetworkChart data={causalData} />
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 450,
                    color: '#666',
                    fontSize: 14,
                  }}>
                    选择通道并点击"推断因果网络"按钮开始分析
                  </div>
                )}
              </div>
            </Spin>
          </Card>
        </div>
      ),
    },
    {
      key: 'labeling',
      label: (
        <span>
          <ExperimentOutlined /> 样本标注
        </span>
      ),
      children: (
        <Card
          size="small"
          style={{ background: '#1a1a2e', borderColor: '#2a2a4a' }}
          bodyStyle={{ padding: 16 }}
          title={<span style={{ color: '#e0e0e0' }}>人工标注与模型管理</span>}
          headStyle={{ background: '#16162e', borderColor: '#2a2a4a' }}
        >
          <LabelingPanel sensorId={sensorId} />
        </Card>
      ),
    },
    {
      key: 'models',
      label: (
        <span>
          <ApiOutlined /> 模型生命周期
        </span>
      ),
      children: (
        <Card
          size="small"
          style={{ background: '#1a1a2e', borderColor: '#2a2a4a' }}
          bodyStyle={{ padding: 16 }}
          title={<span style={{ color: '#e0e0e0' }}>模型版本与训练日志</span>}
          headStyle={{ background: '#16162e', borderColor: '#2a2a4a' }}
        >
          <ModelManager sensorId={sensorId} />
        </Card>
      ),
    },
  ];

  const handleRegionSelect = useCallback(
    (range) => {
      setRegionRange(range);
    },
    []
  );

  const handleRegionCompare = useCallback(async () => {
    if (!regionRange) {
      message.warning('Please select a region on the waveform first (use data zoom)');
      return;
    }
    const result = await withLoading('compare', async () => {
      const { data } = await compareRegion({
        sensor_id: sensorId,
        region_start: regionRange.startTime,
        region_end: regionRange.endTime,
        channel: selectedChannel,
      });
      return data;
    });
    if (result) setRegionCompareData(result);
  }, [sensorId, selectedChannel, regionRange, withLoading]);

  const handleTrain = useCallback(async () => {
    const result = await withLoading('train', async () => {
      const { data } = await trainModel({
        sensor_id: sensorId,
        start_time: timeRange[0].toISOString(),
        end_time: timeRange[1].toISOString(),
      });
      return data;
    });
    if (result) message.success(result.message);
  }, [sensorId, timeRange, withLoading]);

  const fetchCausal = useCallback(async () => {
    setCausalData(null);
    const result = await withLoading('causal', async () => {
      const { data } = await causalInference({
        sensor_id: sensorId,
        start_time: timeRange[0].toISOString(),
        end_time: timeRange[1].toISOString(),
        channels: selectedCausalChannels,
        sample_rate: 50000,
      });
      return data;
    });
    if (result && mountedRef.current) setCausalData(result);
  }, [sensorId, timeRange, selectedCausalChannels, withLoading]);

  const chartItems = [
    {
      key: 'waveform',
      label: 'Waveform',
      children: (
        <Spin spinning={!!loading.waveform}>
          <div style={{ height: 400 }}>
            <WaveformChart
              data={waveformData}
              channelName={selectedChannel}
              onRegionSelect={handleRegionSelect}
            />
          </div>
        </Spin>
      ),
    },
    {
      key: 'spectrum',
      label: 'Spectrum',
      children: (
        <Spin spinning={!!loading.spectrum}>
          <div style={{ height: 400 }}>
            <SpectrumChart data={spectrumData} channelName={selectedChannel} />
          </div>
        </Spin>
      ),
    },
    {
      key: 'timefreq',
      label: 'Time-Frequency (CWT)',
      children: (
        <Spin spinning={!!loading.cwt}>
          <div style={{ height: 450 }}>
            <TimeFreqChart data={cwtData} channelName={selectedChannel} />
          </div>
        </Spin>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#0f0f23' }}>
      <Header
        style={{
          background: '#16162e',
          borderBottom: '1px solid #2a2a4a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThunderboltOutlined style={{ fontSize: 22, color: '#5b8ff9' }} />
          <span style={{ color: '#e0e0e0', fontSize: 18, fontWeight: 600 }}>
            Vibration Analysis & Diagnosis
          </span>
        </div>
        <Space>
          <Select
            value={sensorId}
            onChange={setSensorId}
            style={{ width: 160 }}
            options={[
              { value: 'sensor-001', label: 'Sensor 001' },
              { value: 'sensor-002', label: 'Sensor 002' },
              { value: 'sensor-003', label: 'Sensor 003' },
            ]}
          />
          <Select
            value={selectedChannel}
            onChange={setSelectedChannel}
            style={{ width: 100 }}
            options={CHANNELS.map((ch) => ({ value: ch, label: ch }))}
          />
          <RangePicker
            value={timeRange}
            onChange={setTimeRange}
            showTime
            style={{ width: 380 }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={fetchAll}
            loading={Object.values(loading).some(Boolean)}
          >
            Query
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={handleTrain}>
            Train Model
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: 16 }}>
        <Card
          size="small"
          style={{ background: '#1a1a2e', borderColor: '#2a2a4a', marginBottom: 16 }}
          bodyStyle={{ padding: 8 }}
        >
          <Tabs items={mainTabs} />
        </Card>

        <Divider style={{ borderColor: '#2a2a4a' }} />

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card
              title={<span style={{ color: '#e0e0e0' }}>Feature Trend</span>}
              size="small"
              style={{ background: '#1a1a2e', borderColor: '#2a2a4a' }}
              headStyle={{ background: '#16162e', borderColor: '#2a2a4a' }}
            >
              <div style={{ height: 300 }}>
                <FeatureTrendChart features={featureData} />
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card
              title={<span style={{ color: '#e0e0e0' }}>Diagnostic Records</span>}
              size="small"
              style={{ background: '#1a1a2e', borderColor: '#2a2a4a' }}
              headStyle={{ background: '#16162e', borderColor: '#2a2a4a' }}
            >
              <DiagnosticTable diagnostics={diagnosticData} />
            </Card>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
}
