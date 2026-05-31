import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Input,
  Button,
  Space,
  Alert,
  Spin,
  Typography,
  Divider,
  Table,
  Tag,
  Steps,
  Descriptions,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  SaveOutlined,
  DatabaseOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { parseSQL, storeLineage } from '../utils/api';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Step } = Steps;

const sampleSQL = `CREATE TABLE sales_summary AS
SELECT 
    o.order_date,
    c.customer_name,
    SUM(oi.quantity * oi.unit_price) AS total_amount,
    COUNT(DISTINCT o.order_id) AS order_count
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
JOIN customers c ON o.customer_id = c.customer_id
WHERE o.status = 'completed'
GROUP BY o.order_date, c.customer_name`;

const SQLParserPage = () => {
  const [sql, setSql] = useState(sampleSQL);
  const [targetTable, setTargetTable] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  const handleParse = async () => {
    if (!sql.trim()) {
      message.error('请输入SQL语句');
      return;
    }

    setLoading(true);
    setError(null);
    setParseResult(null);
    setCurrentStep(1);

    try {
      const response = await parseSQL(sql, targetTable || undefined);
      if (response?.success) {
        setParseResult(response.data);
        setCurrentStep(2);
        message.success('SQL解析成功');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'SQL解析失败');
      setCurrentStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!parseResult) {
      return;
    }

    setSaving(true);

    try {
      const response = await storeLineage(sql, targetTable || undefined);
      if (response?.success) {
        message.success(`血缘关系已保存，Job ID: ${response.job_id}`);
        setCurrentStep(3);
      }
    } catch (err) {
      message.error('保存失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const fieldMappingColumns = [
    {
      title: '源表',
      dataIndex: 'source_table',
      key: 'source_table',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '源字段',
      dataIndex: 'source_column',
      key: 'source_column',
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: '转换',
      key: 'transform',
      render: () => <ArrowRightOutlined style={{ color: '#1890ff' }} />,
      align: 'center',
    },
    {
      title: '目标表',
      dataIndex: 'target_table',
      key: 'target_table',
      render: (text) => <Tag color="green">{text}</Tag>,
    },
    {
      title: '目标字段',
      dataIndex: 'target_column',
      key: 'target_column',
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: '转换类型',
      dataIndex: 'transformation_type',
      key: 'transformation_type',
      render: (type) => {
        const colorMap = {
          select: 'blue',
          join: 'orange',
          aggregate: 'purple',
          project: 'cyan',
          filter: 'red',
        };
        return <Tag color={colorMap[type] || 'default'}>{type}</Tag>;
      },
    },
    {
      title: '转换逻辑',
      dataIndex: 'transformation_logic',
      key: 'transformation_logic',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <Title level={3}>
        <DatabaseOutlined style={{ marginRight: 8 }} />
        SQL血缘解析
      </Title>
      <Divider />

      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        <Step title="输入SQL" description="输入Spark SQL语句" />
        <Step title="解析血缘" description="解析字段映射关系" />
        <Step title="保存到图数据库" description="持久化血缘关系" />
      </Steps>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="输入SQL语句" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <TextArea
                rows={12}
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="请输入Spark SQL语句..."
                style={{ fontFamily: 'monospace' }}
              />
              <Space>
                <Input
                  style={{ width: 200 }}
                  placeholder="目标表名（可选）"
                  value={targetTable}
                  onChange={(e) => setTargetTable(e.target.value)}
                />
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleParse}
                  loading={loading}
                >
                  解析血缘
                </Button>
                <Button
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  disabled={!parseResult}
                >
                  保存到数据库
                </Button>
                <Button onClick={() => setSql(sampleSQL)}>加载示例</Button>
              </Space>
            </Space>
          </Card>
        </Col>

        {error && (
          <Col span={24}>
            <Alert message="解析错误" description={error} type="error" showIcon />
          </Col>
        )}

        <Col span={24}>
          <Spin spinning={loading}>
            {parseResult && (
              <>
                <Card title="解析结果摘要" size="small" style={{ marginBottom: 16 }}>
                  <Descriptions column={4} size="small">
                    <Descriptions.Item label="源表数量">
                      <Tag color="blue">{parseResult.source_tables?.length || 0}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="目标表">
                      <Tag color="green">{parseResult.target_table}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="字段映射数">
                      <Tag color="purple">{parseResult.field_mappings?.length || 0}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="转换操作数">
                      <Tag color="orange">{parseResult.transformations?.length || 0}</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title="源表" size="small" style={{ marginBottom: 16 }}>
                  <Space wrap>
                    {parseResult.source_tables?.map((table) => (
                      <Tag key={table} color="blue" style={{ padding: '4px 12px' }}>
                        {table}
                      </Tag>
                    ))}
                  </Space>
                </Card>

                <Card
                  title="字段血缘映射"
                  size="small"
                  extra={
                    <Text type="secondary">
                      共 {parseResult.field_mappings?.length || 0} 条映射
                    </Text>
                  }
                >
                  <Table
                    dataSource={parseResult.field_mappings || []}
                    columns={fieldMappingColumns}
                    size="small"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1000 }}
                    rowKey={(record, index) => index}
                    expandable={{
                      expandedRowRender: (record) => (
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="SQL片段">
                            <pre
                              style={{
                                background: '#f5f5f5',
                                padding: 8,
                                borderRadius: 4,
                                margin: 0,
                                maxHeight: 200,
                                overflow: 'auto',
                              }}
                            >
                              {record.sql_snippet}
                            </pre>
                          </Descriptions.Item>
                        </Descriptions>
                      ),
                    }}
                  />
                </Card>
              </>
            )}
          </Spin>
        </Col>
      </Row>
    </div>
  );
};

export default SQLParserPage;
