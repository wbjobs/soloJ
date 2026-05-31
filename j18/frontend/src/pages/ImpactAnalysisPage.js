import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Select,
  Button,
  Space,
  Alert,
  Spin,
  Typography,
  Divider,
  Statistic,
  List,
  Tag,
  Table,
  Descriptions,
} from 'antd';
import {
  WarningOutlined,
  DatabaseOutlined,
  TableOutlined,
  FieldNumberOutlined,
  PlaySquareOutlined,
} from '@ant-design/icons';
import {
  getTables,
  getTableColumns,
  analyzeImpact,
  getImpactSummary,
} from '../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

const ImpactAnalysisPage = () => {
  const [tables, setTables] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [impactResult, setImpactResult] = useState(null);
  const [impactSummary, setImpactSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      const response = await getTables();
      if (response?.success) {
        setTables(response.data);
      }
    } catch (err) {
      setError('Failed to load tables');
    }
  };

  const handleTableChange = async (tableName) => {
    setSelectedTable(tableName);
    setSelectedColumn(null);
    setColumns([]);
    setImpactResult(null);
    setImpactSummary(null);

    try {
      const response = await getTableColumns(tableName);
      if (response?.success) {
        setColumns(response.data);
      }
    } catch (err) {
      setError('Failed to load columns');
    }
  };

  const handleAnalyze = async () => {
    if (!selectedTable) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await analyzeImpact(selectedTable, selectedColumn);
      if (response?.success) {
        setImpactResult(response.data);
      }

      if (selectedColumn) {
        const summaryResponse = await getImpactSummary(selectedTable, selectedColumn);
        if (summaryResponse?.success) {
          setImpactSummary(summaryResponse.data);
        }
      }
    } catch (err) {
      setError('Failed to analyze impact');
    } finally {
      setLoading(false);
    }
  };

  const affectedColumnsColumns = [
    {
      title: '字段',
      dataIndex: 'column',
      key: 'column',
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: '所属表',
      dataIndex: 'table',
      key: 'table',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
  ];

  const getAffectedColumnsData = () => {
    const affected = impactResult?.affected_columns || [];
    return affected.map((col) => {
      const [table, ...rest] = col.split('.');
      return {
        key: col,
        column: rest.join('.'),
        table,
      };
    });
  };

  return (
    <div>
      <Title level={3}>
        <WarningOutlined style={{ marginRight: 8 }} />
        影响分析
      </Title>
      <Divider />

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small">
            <Space wrap>
              <Select
                style={{ width: 250 }}
                placeholder="选择源表"
                value={selectedTable}
                onChange={handleTableChange}
                allowClear
              >
                {tables.map((table) => (
                  <Option key={table} value={table}>
                    {table}
                  </Option>
                ))}
              </Select>

              <Select
                style={{ width: 200 }}
                placeholder="选择字段（可选，留空分析全表）"
                value={selectedColumn}
                onChange={setSelectedColumn}
                disabled={!selectedTable}
                allowClear
              >
                {columns.map((col) => (
                  <Option key={col} value={col}>
                    {col}
                  </Option>
                ))}
              </Select>

              <Button type="primary" onClick={handleAnalyze} disabled={!selectedTable}>
                分析影响
              </Button>
            </Space>
          </Card>
        </Col>

        {error && (
          <Col span={24}>
            <Alert message="错误" description={error} type="error" showIcon />
          </Col>
        )}

        <Col span={24}>
          <Spin spinning={loading}>
            {impactSummary && (
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="受影响字段"
                      value={impactSummary.affected_columns_count}
                      prefix={<FieldNumberOutlined />}
                      valueStyle={{ color: '#cf1322' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="受影响表"
                      value={impactSummary.affected_tables_count}
                      prefix={<TableOutlined />}
                      valueStyle={{ color: '#fa8c16' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="受影响Job"
                      value={impactSummary.affected_jobs_count}
                      prefix={<PlaySquareOutlined />}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="影响链长度"
                      value={impactSummary.impact_chain_length}
                      prefix={<DatabaseOutlined />}
                      suffix="级"
                    />
                  </Card>
                </Col>
              </Row>
            )}

            {impactResult && (
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Card title="受影响字段列表" size="small">
                    <Table
                      dataSource={getAffectedColumnsData()}
                      columns={affectedColumnsColumns}
                      size="small"
                      pagination={{ pageSize: 10 }}
                      scroll={{ y: 300 }}
                    />
                  </Card>
                </Col>

                <Col span={12}>
                  <Card title="受影响表分布" size="small">
                    <List
                      size="small"
                      dataSource={Object.entries(
                        impactSummary?.affected_tables_distribution || {}
                      )}
                      renderItem={([table, count]) => (
                        <List.Item>
                          <Space>
                            <Tag color="green">{table}</Tag>
                            <span>{count} 个字段受影响</span>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </Card>

                  {impactResult?.impact_path &&
                    impactResult.impact_path.length > 0 && (
                      <Card
                        title="影响路径（前5条）"
                        size="small"
                        style={{ marginTop: 16 }}
                      >
                        <List
                          size="small"
                          dataSource={impactResult.impact_path.slice(0, 5)}
                          renderItem={(path, index) => (
                            <List.Item>
                              <Descriptions column={1} size="small">
                                <Descriptions.Item label="路径">
                                  {path.path?.map((p) => p.column).join(' → ')}
                                </Descriptions.Item>
                                <Descriptions.Item label="转换次数">
                                  <Tag color="orange">{path.length} 次</Tag>
                                </Descriptions.Item>
                              </Descriptions>
                            </List.Item>
                          )}
                        />
                      </Card>
                    )}
                </Col>
              </Row>
            )}

            {!loading && !impactResult && (
              <Card style={{ marginTop: 16, textAlign: 'center', color: '#999' }}>
                <DatabaseOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>选择表和字段后点击"分析影响"查看结果</p>
              </Card>
            )}
          </Spin>
        </Col>
      </Row>
    </div>
  );
};

export default ImpactAnalysisPage;
