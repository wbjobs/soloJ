import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  Input,
  Rate,
  Tag,
  Space,
  message,
  Popconfirm,
  Card,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  SyncOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { getLabeledSamples, labelSample, incrementalTrain, getModelStats } from '../api';

const { TextArea } = Input;
const { Option } = Select;

const LABEL_OPTIONS = [
  { value: 'normal', label: '正常', color: 'green' },
  { value: 'bearing_fault', label: '轴承故障', color: 'red' },
  { value: 'gear_wear', label: '齿轮磨损', color: 'orange' },
  { value: 'misalignment', label: '不对中', color: 'blue' },
  { value: 'looseness', label: '松动', color: 'purple' },
  { value: 'unknown', label: '未知', color: 'default' },
];

const LabelingPanel = ({ sensorId, pendingSamples }) => {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSample, setSelectedSample] = useState(null);
  const [form] = Form.useForm();
  const [modelStats, setModelStats] = useState(null);
  const [training, setTraining] = useState(false);

  const fetchSamples = useCallback(async () => {
    if (!sensorId) return;
    setLoading(true);
    try {
      const { data } = await getLabeledSamples(sensorId, false, 100);
      setSamples(data.samples || []);
    } catch (err) {
      message.error('获取标注样本失败');
    } finally {
      setLoading(false);
    }
  }, [sensorId]);

  const fetchModelStats = useCallback(async () => {
    if (!sensorId) return;
    try {
      const { data } = await getModelStats(sensorId);
      setModelStats(data);
    } catch (err) {
      console.error('获取模型统计失败');
    }
  }, [sensorId]);

  useEffect(() => {
    fetchSamples();
    fetchModelStats();
  }, [fetchSamples, fetchModelStats, pendingSamples]);

  const handleLabel = (sample) => {
    setSelectedSample(sample);
    form.setFieldsValue({
      corrected_label: sample.corrected_label || 'normal',
      confidence: sample.confidence ? sample.confidence * 5 : 3,
      annotator: sample.annotator || '',
      notes: sample.notes || '',
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    if (!selectedSample) return;

    try {
      await labelSample({
        sensor_id: sensorId,
        diagnostic_id: selectedSample.diagnostic_id,
        timestamp: selectedSample.timestamp,
        features: selectedSample.features,
        original_prediction: selectedSample.original_prediction,
        corrected_label: values.corrected_label,
        confidence: values.confidence / 5,
        annotator: values.annotator,
        notes: values.notes,
      });
      message.success('标注保存成功');
      setModalVisible(false);
      fetchSamples();
      fetchModelStats();
    } catch (err) {
      message.error('标注保存失败');
    }
  };

  const handleIncrementalTrain = async () => {
    if (samples.length === 0) {
      message.warning('没有待训练的标注样本');
      return;
    }

    setTraining(true);
    try {
      const { data } = await incrementalTrain({
        sensor_id: sensorId,
        triggered_by: 'manual',
      });
      message.success(`增量训练完成！新版本: ${data.new_model_version}`);
      fetchSamples();
      fetchModelStats();
    } catch (err) {
      message.error(`增量训练失败: ${err.response?.data?.detail || err.message}`);
    } finally {
      setTraining(false);
    }
  };

  const getLabelColor = (label) => {
    const opt = LABEL_OPTIONS.find(o => o.value === label);
    return opt ? opt.color : 'default';
  };

  const getLabelText = (label) => {
    const opt = LABEL_OPTIONS.find(o => o.value === label);
    return opt ? opt.label : label;
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (t) => new Date(t).toLocaleString(),
    },
    {
      title: '原始预测',
      dataIndex: 'original_prediction',
      key: 'original',
      width: 120,
      render: (v) => <Tag color={getLabelColor(v)}>{getLabelText(v)}</Tag>,
    },
    {
      title: '修正标签',
      dataIndex: 'corrected_label',
      key: 'corrected',
      width: 120,
      render: (v) => v ? <Tag color={getLabelColor(v)}>{getLabelText(v)}</Tag> : '-',
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (v) => v !== undefined ? `${(v * 100).toFixed(0)}%` : '-',
    },
    {
      title: '标注者',
      dataIndex: 'annotator',
      key: 'annotator',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'used_in_training',
      key: 'status',
      width: 100,
      render: (used) => used ? (
        <Tag color="green"><CheckCircleOutlined /> 已训练</Tag>
      ) : (
        <Tag color="orange"><SyncOutlined spin /> 待训练</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleLabel(record)}
            disabled={record.used_in_training}
          >
            标注
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="待训练样本"
              value={modelStats?.pending_labeled_samples || 0}
              prefix={<ExperimentOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="当前模型版本"
              value={modelStats?.active_version?.version || '-'}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="总训练样本"
              value={modelStats?.active_version?.training_samples || 0}
              prefix={<CloseCircleOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Space>
          <Button onClick={fetchSamples} loading={loading}>
            刷新
          </Button>
          <Popconfirm
            title="确认开始增量训练？"
            description={`将使用 ${samples.filter(s => !s.used_in_training).length} 个新标注样本进行增量训练`}
            onConfirm={handleIncrementalTrain}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="primary"
              icon={<SyncOutlined />}
              loading={training}
              disabled={samples.filter(s => !s.used_in_training).length === 0}
            >
              开始增量训练
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={samples}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 10 }}
        scroll={{ y: 300 }}
      />

      <Modal
        title="人工标注"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedSample && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>原始预测</div>
              <Tag color={getLabelColor(selectedSample.original_prediction)}>
                {getLabelText(selectedSample.original_prediction)}
              </Tag>
              <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                时间: {new Date(selectedSample.timestamp).toLocaleString()}
              </div>
            </div>

            <Form.Item
              name="corrected_label"
              label="修正标签"
              rules={[{ required: true, message: '请选择修正标签' }]}
            >
              <Select>
                {LABEL_OPTIONS.map(opt => (
                  <Option key={opt.value} value={opt.value}>
                    <Tag color={opt.color}>{opt.label}</Tag>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="confidence"
              label="标注置信度"
            >
              <Rate />
            </Form.Item>

            <Form.Item
              name="annotator"
              label="标注者"
            >
              <Input placeholder="请输入标注者姓名" />
            </Form.Item>

            <Form.Item
              name="notes"
              label="备注"
            >
              <TextArea rows={3} placeholder="标注备注信息..." />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setModalVisible(false)}>取消</Button>
                <Button type="primary" htmlType="submit">保存标注</Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default LabelingPanel;
