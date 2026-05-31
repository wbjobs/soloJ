import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  message,
  Card,
  Timeline,
  Row,
  Col,
  Statistic,
  Tooltip,
  Progress,
} from 'antd';
import {
  HistoryOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  RocketOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import { getModelHistory, getTrainingLogs, getModelStats } from '../api';

const ModelManager = ({ sensorId }) => {
  const [modelHistory, setModelHistory] = useState([]);
  const [activeVersion, setActiveVersion] = useState(null);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [loading, setLoading] = useState({ history: false, logs: false });
  const [modelStats, setModelStats] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!sensorId) return;
    setLoading(prev => ({ ...prev, history: true }));
    try {
      const { data } = await getModelHistory(sensorId);
      setModelHistory(data.history || []);
      setActiveVersion(data.active_version);
    } catch (err) {
      message.error('获取模型历史失败');
    } finally {
      setLoading(prev => ({ ...prev, history: false }));
    }
  }, [sensorId]);

  const fetchLogs = useCallback(async () => {
    if (!sensorId) return;
    setLoading(prev => ({ ...prev, logs: true }));
    try {
      const { data } = await getTrainingLogs(sensorId, 20);
      setTrainingLogs(data.logs || []);
    } catch (err) {
      message.error('获取训练日志失败');
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  }, [sensorId]);

  const fetchStats = useCallback(async () => {
    if (!sensorId) return;
    try {
      const { data } = await getModelStats(sensorId);
      setModelStats(data);
    } catch (err) {
      console.error('获取模型统计失败');
    }
  }, [sensorId]);

  useEffect(() => {
    fetchHistory();
    fetchLogs();
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchHistory, fetchLogs, fetchStats]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'running':
        return <SyncOutlined spin style={{ color: '#1890ff' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'green';
      case 'failed': return 'red';
      case 'running': return 'blue';
      default: return 'orange';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'success': return '成功';
      case 'failed': return '失败';
      case 'running': return '训练中';
      default: return '等待中';
    }
  };

  const historyColumns = [
    {
      title: '版本号',
      dataIndex: 'version',
      key: 'version',
      width: 140,
      render: (v, record) => (
        <Space>
          <span style={{ fontWeight: record.is_active ? 'bold' : 'normal' }}>{v}</span>
          {record.is_active && <Tag color="green" size="small">当前</Tag>}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (t) => new Date(t).toLocaleString(),
    },
    {
      title: '训练样本',
      dataIndex: 'training_samples',
      key: 'training_samples',
      width: 120,
      render: (v) => v?.toLocaleString() || 0,
    },
    {
      title: '增量样本',
      dataIndex: 'incremental_samples',
      key: 'incremental_samples',
      width: 120,
      render: (v, record) => (
        <Space>
          <ArrowUpOutlined style={{ color: '#52c41a' }} />
          <span>{v || 0}</span>
        </Space>
      ),
    },
    {
      title: '父版本',
      dataIndex: 'parent_version',
      key: 'parent_version',
      width: 120,
      render: (v) => v || '-',
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="当前版本"
              value={activeVersion?.version || '未训练'}
              prefix={<RocketOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ fontSize: 16 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总训练样本"
              value={activeVersion?.training_samples || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="版本数量"
              value={modelHistory.length}
              prefix={<HistoryOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="待标注样本"
              value={modelStats?.pending_labeled_samples || 0}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card
            title={
              <Space>
                <HistoryOutlined />
                模型版本历史
              </Space>
            }
            size="small"
            extra={
              <Button size="small" onClick={fetchHistory} loading={loading.history}>
                刷新
              </Button>
            }
          >
            <Table
              columns={historyColumns}
              dataSource={modelHistory}
              rowKey="version"
              size="small"
              loading={loading.history}
              pagination={{ pageSize: 5 }}
              scroll={{ y: 250 }}
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card
            title={
              <Space>
                <SyncOutlined />
                训练日志
              </Space>
            }
            size="small"
            extra={
              <Button size="small" onClick={fetchLogs} loading={loading.logs}>
                刷新
              </Button>
            }
          >
            <Timeline
              style={{ maxHeight: 320, overflow: 'auto', paddingRight: 8 }}
              items={trainingLogs.map(log => ({
                color: getStatusColor(log.status),
                dot: getStatusIcon(log.status),
                children: (
                  <div style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                      <Tag color={getStatusColor(log.status)} size="small">
                        {getStatusText(log.status)}
                      </Tag>
                      <span style={{ marginLeft: 8 }}>
                        {log.triggered_by === 'manual' ? '手动触发' : '自动触发'}
                      </span>
                    </div>
                    {log.samples_added !== undefined && (
                      <div style={{ color: '#666' }}>
                        新增样本: {log.samples_added}
                      </div>
                    )}
                    {log.new_model_version && (
                      <div style={{ color: '#52c41a' }}>
                        新版本: {log.new_model_version}
                      </div>
                    )}
                    {log.duration_seconds !== undefined && (
                      <div style={{ color: '#666' }}>
                        耗时: {log.duration_seconds.toFixed(2)}s
                      </div>
                    )}
                    {log.error_message && (
                      <div style={{ color: '#ff4d4f' }}>
                        错误: {log.error_message}
                      </div>
                    )}
                    <div style={{ color: '#999', marginTop: 4 }}>
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                ),
              }))}
            />
            {trainingLogs.length === 0 && !loading.logs && (
              <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                暂无训练日志
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {modelStats?.training_stats && (
        <Card
          title="训练统计"
          size="small"
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <div style={{ marginBottom: 8 }}>孤立森林</div>
              <Progress
                percent={Math.min(100, (modelStats.training_stats.iforest_samples || 0) / 100)}
                format={() => `${modelStats.training_stats.iforest_samples || 0} 样本`}
              />
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 8 }}>单类SVM</div>
              <Progress
                percent={Math.min(100, (modelStats.training_stats.ocsvm_samples || 0) / 100)}
                format={() => `${modelStats.training_stats.ocsvm_samples || 0} 样本`}
              />
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 8 }}>集成状态</div>
              <Tag color={modelStats.training_stats.is_fitted ? 'green' : 'orange'}>
                {modelStats.training_stats.is_fitted ? '已训练' : '未训练'}
              </Tag>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default ModelManager;
