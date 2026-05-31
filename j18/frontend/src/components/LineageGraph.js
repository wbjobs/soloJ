import React, { useCallback, useRef, useEffect, useState } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
} from 'react-flow-renderer';
import dagre from 'dagre';
import { Card, Drawer, Descriptions, Tag, Typography } from 'antd';
import { getTransformationDetails } from '../utils/api';

const { Text, Paragraph } = Typography;

const nodeWidth = 160;
const nodeHeight = 50;

const CustomColumnNode = ({ data, selected }) => (
  <div
    className={`node-column ${selected ? 'node-selected' : ''}`}
    style={{
      cursor: 'pointer',
    }}
    onClick={() => data.onClick(data)}
  >
    <div style={{ fontWeight: 500, marginBottom: 4 }}>{data.label}</div>
    <Tag color="blue" style={{ fontSize: 10, padding: '0 4px' }}>
      字段
    </Tag>
  </div>
);

const CustomTableNode = ({ data, selected }) => (
  <div
    className={`node-table ${selected ? 'node-selected' : ''}`}
    style={{ cursor: 'pointer' }}
    onClick={() => data.onClick(data)}
  >
    <div style={{ fontWeight: 600 }}>{data.label}</div>
    <Tag color="green" style={{ fontSize: 10, padding: '0 4px' }}>
      表
    </Tag>
  </div>
);

const nodeTypes = {
  column: CustomColumnNode,
  table: CustomTableNode,
};

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? 'left' : 'top';
    node.sourcePosition = isHorizontal ? 'right' : 'bottom';

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

const LineageGraph = ({ nodes: initialNodes, edges: initialEdges, onNodeClick }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [transformationDetails, setTransformationDetails] = useState({});
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (initialNodes && initialEdges) {
      const transformedNodes = initialNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onClick: handleNodeClick,
        },
      }));

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        transformedNodes,
        initialEdges,
        'LR'
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      setTimeout(() => fitView(), 100);
    }
  }, [initialNodes, initialEdges]);

  const handleNodeClick = useCallback(async (nodeData) => {
    setSelectedNode(nodeData);
    setDrawerVisible(true);

    if (nodeData.type === 'column') {
      setTransformationDetails({});
    }

    if (onNodeClick) {
      onNodeClick(nodeData);
    }
  }, [onNodeClick]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleEdgeClick = async (event, edge) => {
    try {
      const details = await getTransformationDetails(edge.source, edge.target);
      if (details?.data) {
        setTransformationDetails(details.data);
      }
    } catch (error) {
      console.error('Failed to get transformation details:', error);
    }
  };

  return (
    <div ref={reactFlowWrapper} className="lineage-graph-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={handleEdgeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>

      <Drawer
        title="节点详情"
        placement="right"
        width={400}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {selectedNode && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{selectedNode.id}</Descriptions.Item>
            <Descriptions.Item label="名称">{selectedNode.label}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={selectedNode.type === 'table' ? 'green' : 'blue'}>
                {selectedNode.type === 'table' ? '表' : '字段'}
              </Tag>
            </Descriptions.Item>
            {selectedNode.table && (
              <Descriptions.Item label="所属表">{selectedNode.table}</Descriptions.Item>
            )}
          </Descriptions>
        )}

        {Object.keys(transformationDetails).length > 0 && (
          <Card title="转换详情" style={{ marginTop: 16 }} size="small">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="转换类型">
                <Tag color="orange">{transformationDetails.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="转换逻辑">
                <Text>{transformationDetails.logic}</Text>
              </Descriptions.Item>
              {transformationDetails.sql && (
                <Descriptions.Item label="SQL片段">
                  <Paragraph
                    style={{
                      background: '#f5f5f5',
                      padding: 8,
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    }}
                  >
                    {transformationDetails.sql}
                  </Paragraph>
                </Descriptions.Item>
              )}
              {transformationDetails.job_id && (
                <Descriptions.Item label="Job ID">
                  <Text code>{transformationDetails.job_id}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}
      </Drawer>
    </div>
  );
};

const LineageGraphWithProvider = (props) => (
  <ReactFlowProvider>
    <LineageGraph {...props} />
  </ReactFlowProvider>
);

export default LineageGraphWithProvider;
