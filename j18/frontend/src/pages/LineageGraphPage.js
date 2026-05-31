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
  Radio,
} from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import LineageGraph from '../components/LineageGraph';
import {
  getTables,
  getTableColumns,
  getColumnLineage,
  getFullLineage,
} from '../utils/api';

const { Title } = Typography;
const { Option } = Select;

const LineageGraphPage = () => {
  const [tables, setTables] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [direction, setDirection] = useState('both');
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('full');

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (viewMode === 'full') {
      loadFullLineage();
    }
  }, [viewMode]);

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

    try {
      const response = await getTableColumns(tableName);
      if (response?.success) {
        setColumns(response.data);
      }
    } catch (err) {
      setError('Failed to load columns');
    }
  };

  const loadFullLineage = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getFullLineage(5);
      if (response?.success) {
        setGraphData(transformGraphData(response.data));
      }
    } catch (err) {
      setError('Failed to load lineage graph');
    } finally {
      setLoading(false);
    }
  };

  const loadColumnLineage = async () => {
    if (!selectedTable || !selectedColumn) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getColumnLineage(selectedTable, selectedColumn, direction);
      if (response?.success) {
        setGraphData(transformGraphData(response.data));
      }
    } catch (err) {
      setError('Failed to load column lineage');
    } finally {
      setLoading(false);
    }
  };

  const transformGraphData = (data) => {
    const { nodes = [], edges = [] } = data;

    const transformedNodes = nodes.map((node) => ({
      id: node.id,
      type: node.type,
      data: {
        label: node.column || node.name || node.id,
        id: node.id,
        table: node.table,
        type: node.type,
      },
    }));

    const transformedEdges = edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.type,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#1890ff' },
      data: {
        type: edge.type,
        sql: edge.sql,
        logic: edge.logic,
      },
    }));

    return { nodes: transformedNodes, edges: transformedEdges };
  };

  const handleNodeClick = (nodeData) => {
    console.log('Node clicked:', nodeData);
  };

  return (
    <div>
      <Title level={3}>数据血缘图谱</Title>
      <Divider />

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card size="small">
            <Space wrap>
              <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                <Radio.Button value="full">全量视图</Radio.Button>
                <Radio.Button value="column">字段视图</Radio.Button>
              </Radio.Group>

              {viewMode === 'column' && (
                <>
                  <Select
                    style={{ width: 200 }}
                    placeholder="选择表"
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
                    placeholder="选择字段"
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

                  <Select
                    style={{ width: 120 }}
                    value={direction}
                    onChange={setDirection}
                  >
                    <Option value="upstream">上游溯源</Option>
                    <Option value="downstream">下游追踪</Option>
                    <Option value="both">双向</Option>
                  </Select>

                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={loadColumnLineage}
                    disabled={!selectedTable || !selectedColumn}
                  >
                    查询血缘
                  </Button>
                </>
              )}

              <Button
                icon={<ReloadOutlined />}
                onClick={viewMode === 'full' ? loadFullLineage : loadColumnLineage}
              >
                刷新
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
          <Card
            title={
              <Space>
                <span>血缘关系图</span>
                <span style={{ color: '#999', fontSize: 12 }}>
                  节点数: {graphData.nodes.length} | 连线数: {graphData.edges.length}
                </span>
              </Space>
            }
          >
            <Spin spinning={loading}>
              {graphData.nodes.length > 0 ? (
                <LineageGraph
                  nodes={graphData.nodes}
                  edges={graphData.edges}
                  onNodeClick={handleNodeClick}
                />
              ) : (
                <div
                  style={{
                    height: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                  }}
                >
                  {loading ? '加载中...' : '暂无数据，请先导入SQL血缘'}
                </div>
              )}
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default LineageGraphPage;
