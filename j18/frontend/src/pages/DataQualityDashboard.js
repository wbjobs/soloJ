import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Alert,
  Progress,
  Empty,
  Tabs,
} from 'antd';
import {
  WarningOutlined,
  DashboardOutlined,
  SafetyOutlined,
  BugOutlined,
  LineChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import LineageGraphWithQuality from '../components/LineageGraphWithQuality';
import { dataQualityApi, getAlertColor, getQualityColor, getAnomalyRateColor } from '../utils/dataQualityApi';

const { TabPane } = Tabs;
const { Option } = Select;

const DataQualityDashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [columnsWithAlerts, setColumnsWithAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [propagationModalVisible, setPropagationModalVisible] = useState(false);
  const [propagationResult, setPropagationResult] = useState(null);
  const [propagationVisualization, setPropagationVisualization] = useState(null);
  const [form] = Form.useForm();
  const [propagationForm] = Form.useForm();
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadAlerts();
    loadColumnsWithAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const result = await dataQualityApi.getQualityAlerts();
      if (result.success) {
        setAlerts(result.data || []);
      }
    } catch (error) {
      console.error('加载预警失败:', error);
    }
    setLoading(false);
  };

  const loadColumnsWithAlerts = async () => {
    try {
      const result = await dataQualityApi.getColumnsWithAlerts();
      if (result.success) {
        setColumnsWithAlerts(result.data || []);
      }
    } catch (error) {
      console.error('加载预警字段失败:', error);
    }
  };

  const handleStoreMetrics = async (values) => {
    try {
      const metrics = {
        null_rate: values.null_rate || 0,
        duplicate_rate: values.duplicate_rate || 0,
        outlier_rate: values.outlier_rate || 0,
        invalid_format_rate: values.invalid_format_rate || 0,
        value_range_violation: values.value_range_violation || 0,
        uniqueness_violation: values.uniqueness_violation || 0,
        quality_score: 1 - (
          (values.null_rate || 0) * 0.3 +
          (values.duplicate_rate || 0) * 0.2 +
          (values.outlier_rate || 0) * 0.2 +
          (values.invalid_format_rate || 0) * 0.15 +
          (values.value_range_violation || 0) * 0.1 +
          (values.uniqueness_violation || 0) * 0.05
        ),
        has_alert: (values.null_rate || 0) > 0.05 || (values.outlier_rate || 0) > 0.03,
      };

      await dataQualityApi.storeQualityMetrics(values.table_name, values.column_name, metrics);
      await dataQualityApi.generateAlerts(values.table_name, values.column_name, metrics);

      setModalVisible(false);
      form.resetFields();
      loadAlerts();
      loadColumnsWithAlerts();
    } catch (error) {
      console.error('存储质量指标失败:', error);
    }
  };

  const handleAnalyzePropagation = async (values) => {
    setLoading(true);
    try {
      const result = await dataQualityApi.analyzeAnomalyPropagation(
        values.table_name,
        values.column_name,
        values.source_anomaly_rate
      );

      if (result.success) {
        setPropagationResult(result.data);
        const vizResult = await dataQualityApi.getAnomalyVisualization(
          values.table_name,
          values.column_name,
          values.source_anomaly_rate
        );
        if (vizResult.success) {
          setPropagationVisualization(vizResult.data);
        }
      }
    } catch (error) {
      console.error('分析异常传播失败:', error);
    }
    setLoading(false);
  };

  const alertColumns = [
    {
      title: '表名',
      dataIndex: 'table_name',
      key: 'table_name',
      width: 150,
    },
    {
      title: '字段名',
      dataIndex: 'column_name',
      key: 'column_name',
      width: 150,
    },
    {
      title: '指标类型',
      dataIndex: 'metric_type',
      key: 'metric_type',
      width: 150,
      render: (type) => type.replace('_rate', '').replace('_', ' '),
    },
    {
      title: '当前值',
      dataIndex: 'metric_value',
      key: 'metric_value',
      width: 100,
      render: (val) => `${(val * 100).toFixed(2)}%`,
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 100,
      render: (val) => `${(val * 100).toFixed(2)}%`,
    },
    {
      title: '级别',
      dataIndex: 'alert_level',
      key: 'alert_level',
      width: 100,
      render: (level) => (
        <Tag color={getAlertColor(level)} style={{ margin: 0 }}>
          {level.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time) => new Date(time).toLocaleString(),
    },
  ];

  const columnAlertColumns = [
    {
      title: '字段ID',
      dataIndex: 'column_id',
      key: 'column_id',
      width: 200,
    },
    {
      title: '表名',
      dataIndex: 'table_name',
      key: 'table_name',
      width: 120,
    },
    {
      title: '字段名',
      dataIndex: 'column_name',
      key: 'column_name',
      width: 120,
    },
    {
      title: '质量分数',
      dataIndex: 'quality_score',
      key: 'quality_score',
      width: 180,
      render: (score) => (
        <Progress
          percent={(score * 100).toFixed(0)}
          strokeColor={getQualityColor(score)}
          size="small"
        />
      ),
    },
    {
      title: '预警级别',
      dataIndex: 'alert_levels',
      key: 'alert_levels',
      width: 150,
      render: (levels) => (
        <Space>
          {levels?.map((level, idx) => (
            <Tag key={idx} color={getAlertColor(level)}>
              {level.toUpperCase()}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '预警数',
      dataIndex: 'alert_count',
      key: 'alert_count',
      width: 80,
      render: (count) => (
        <Tag color="red" icon={<WarningOutlined />}>
          {count}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<LineChartOutlined />}
            onClick={() => {
              setSelectedColumn(record);
              propagationForm.setFieldsValue({
                table_name: record.table_name,
                column_name: record.column_name,
                source_anomaly_rate: 0.15,
              });
              setPropagationModalVisible(true);
            }}
          >
            异常传播分析
          </Button>
        </Space>
      ),
    },
  ];

  const criticalCount = alerts.filter(a => a.alert_level === 'critical' || a.alert_level === 'fatal').length;
  const warningCount = alerts.filter(a => a.alert_level === 'warning').length;
  const infoCount = alerts.filter(a => a.alert_level === 'info').length;
  const unresolvedCount = alerts.filter(a => !a.resolved).length;

  return (
    <div style={{ padding: 24 }}>
      <Card title={<span><SafetyOutlined /> 数据质量仪表盘</span>}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={<span><DashboardOutlined /> 总览</span>} key="dashboard">
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Statistic
                  title="严重预警"
                  value={criticalCount}
                  valueStyle={{ color: '#f5222d' }}
                  prefix={<WarningOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="警告"
                  value={warningCount}
                  valueStyle={{ color: '#faad14' }}
                  prefix={<WarningOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="提示"
                  value={infoCount}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<WarningOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="待处理"
                  value={unresolvedCount}
                  valueStyle={{ color: '#722ed1' }}
                  prefix={<BugOutlined />}
                />
              </Col>
            </Row>

            <Card
              title="有预警的字段"
              extra={
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    loadAlerts();
                    loadColumnsWithAlerts();
                  }}
                >
                  刷新
                </Button>
              }
              style={{ marginBottom: 24 }}
            >
              {columnsWithAlerts.length > 0 ? (
                <Table
                  columns={columnAlertColumns}
                  dataSource={columnsWithAlerts}
                  rowKey="column_id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty description="暂无质量预警" />
              )}
            </Card>

            <Card title="预警列表">
              {alerts.length > 0 ? (
                <Table
                  columns={alertColumns}
                  dataSource={alerts}
                  rowKey="alert_id"
                  pagination={{ pageSize: 10 }}
                  size="small"
                />
              ) : (
                <Empty description="暂无预警数据" />
              )}
            </Card>
          </TabPane>

          <TabPane tab={<span><LineChartOutlined /> 异常传播分析</span>} key="propagation">
            <Row gutter={16}>
              <Col span={8}>
                <Card title="设置源字段异常">
                  <Form
                    form={propagationForm}
                    layout="vertical"
                    onFinish={handleAnalyzePropagation}
                  >
                    <Form.Item
                      name="table_name"
                      label="表名"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="例如: orders" />
                    </Form.Item>
                    <Form.Item
                      name="column_name"
                      label="字段名"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="例如: amount" />
                    </Form.Item>
                    <Form.Item
                      name="source_anomaly_rate"
                      label="源异常率 (0-1)"
                      rules={[{ required: true }]}
                    >
                      <InputNumber
                        min={0}
                        max={1}
                        step={0.01}
                        style={{ width: '100%' }}
                        placeholder="例如: 0.15 表示15%"
                      />
                    </Form.Item>
                    <Form.Item
                      name="anomaly_type"
                      label="异常类型"
                    >
                      <Select defaultValue="null_rate">
                        <Option value="null_rate">空值率</Option>
                        <Option value="outlier_rate">异常值率</Option>
                        <Option value="duplicate_rate">重复率</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item>
                      <Button type="primary" htmlType="submit" loading={loading} block>
                        分析异常传播
                      </Button>
                    </Form.Item>
                  </Form>

                  {propagationResult && (
                    <Card title="分析结果" size="small">
                      <p><strong>源字段:</strong> {propagationResult.source_table}.{propagationResult.source_column}</p>
                      <p><strong>源异常率:</strong> {(propagationResult.source_anomaly_rate * 100).toFixed(1)}%</p>
                      <p><strong>影响字段数:</strong> {propagationResult.affected_columns?.length || 0}</p>
                      <p><strong>影响表数:</strong> {propagationResult.affected_tables?.length || 0}</p>
                      {propagationResult.estimated_impact && (
                        <>
                          <p><strong>风险等级:</strong>
                            <Tag color={
                              propagationResult.estimated_impact.risk_level === 'CRITICAL' ? 'red' :
                              propagationResult.estimated_impact.risk_level === 'HIGH' ? 'orange' :
                              propagationResult.estimated_impact.risk_level === 'MEDIUM' ? 'gold' : 'green'
                            }>
                              {propagationResult.estimated_impact.risk_level}
                            </Tag>
                          </p>
                          <p><strong>最大传播异常率:</strong> {(propagationResult.estimated_impact.max_anomaly_rate * 100).toFixed(1)}%</p>
                        </>
                      )}
                    </Card>
                  )}
                </Card>
              </Col>
              <Col span={16}>
                <Card title="异常传播可视化">
                  {propagationVisualization ? (
                    <LineageGraphWithQuality
                      data={propagationVisualization}
                      showQuality={false}
                      height={500}
                      anomalyHighlight={{
                        paths: propagationResult?.propagation_path || [],
                        affectedNodes: propagationResult?.affected_columns || [],
                      }}
                    />
                  ) : (
                    <Empty description="请设置源字段并分析异常传播" />
                  )}
                </Card>
              </Col>
            </Row>

            {propagationResult && propagationResult.propagation_chain && (
              <Card title="传播路径详情" style={{ marginTop: 16 }}>
                <Table
                  columns={[
                    {
                      title: '目标字段',
                      key: 'target',
                      render: (_, record) => `${record.table_name}.${record.column_name}`,
                    },
                    {
                      title: '传播类型',
                      dataIndex: 'propagation_type',
                      key: 'propagation_type',
                      render: (type) => <Tag>{type}</Tag>,
                    },
                    {
                      title: '输入异常率',
                      dataIndex: 'input_anomaly_rate',
                      key: 'input_anomaly_rate',
                      render: (val) => (
                        <span style={{ color: getAnomalyRateColor(val) }}>
                          {(val * 100).toFixed(2)}%
                        </span>
                      ),
                    },
                    {
                      title: '输出异常率',
                      dataIndex: 'output_anomaly_rate',
                      key: 'output_anomaly_rate',
                      render: (val) => (
                        <span style={{ color: getAnomalyRateColor(val), fontWeight: 'bold' }}>
                          {(val * 100).toFixed(2)}%
                        </span>
                      ),
                    },
                    {
                      title: '置信度',
                      dataIndex: 'confidence',
                      key: 'confidence',
                      render: (val) => `${(val * 100).toFixed(0)}%`,
                    },
                  ]}
                  dataSource={propagationResult.propagation_chain}
                  rowKey="column_id"
                  pagination={false}
                  size="small"
                />
              </Card>
            )}
          </TabPane>

          <TabPane tab={<span><BugOutlined /> 模拟数据</span>} key="simulate">
            <Alert
              message="模拟质量数据"
              description="这里可以快速生成模拟的质量指标数据，用于测试预警和异常传播功能。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Card title="添加质量指标" extra={<Button type="primary" onClick={() => setModalVisible(true)}>添加指标</Button>}>
              <Empty description="请点击上方按钮添加质量指标" />
            </Card>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="添加质量指标"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleStoreMetrics}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="table_name" label="表名" rules={[{ required: true }]}>
                <Input placeholder="例如: orders" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="column_name" label="字段名" rules={[{ required: true }]}>
                <Input placeholder="例如: amount" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="null_rate" label="空值率 (0-1)" initialValue={0.02}>
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="duplicate_rate" label="重复率 (0-1)" initialValue={0.01}>
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="outlier_rate" label="异常值率 (0-1)" initialValue={0.03}>
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="invalid_format_rate" label="格式错误率" initialValue={0.01}>
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="value_range_violation" label="值域违规率" initialValue={0.01}>
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="uniqueness_violation" label="唯一性违规率" initialValue={0}>
                <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">提交</Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DataQualityDashboard;
