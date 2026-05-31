import React, { useMemo } from 'react';
import { Table, Tag, Progress } from 'antd';
import dayjs from 'dayjs';

const anomalyColor = { normal: 'green', anomaly: 'red' };

export default function DiagnosticTable({ diagnostics }) {
  const columns = useMemo(
    () => [
      {
        title: 'Time',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 180,
        render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: 'Status',
        dataIndex: 'anomaly_label',
        key: 'anomaly_label',
        width: 100,
        render: (v) => <Tag color={anomalyColor[v] || 'default'}>{v?.toUpperCase()}</Tag>,
      },
      {
        title: 'Score',
        dataIndex: 'anomaly_score',
        key: 'anomaly_score',
        width: 100,
        render: (v) => (v != null ? Number(v).toFixed(3) : '-'),
      },
      {
        title: 'Top Fault',
        key: 'top_fault',
        width: 140,
        render: (_, record) => {
          const probs = record.fault_probabilities || {};
          const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]);
          if (sorted.length === 0) return '-';
          const [fault, prob] = sorted[0];
          return (
            <span>
              {fault} <Progress percent={Math.round(prob * 100)} size="small" style={{ width: 60, display: 'inline-block' }} />
            </span>
          );
        },
      },
      {
        title: 'Probabilities',
        key: 'probs',
        render: (_, record) => {
          const probs = record.fault_probabilities || {};
          return (
            <div style={{ fontSize: 11 }}>
              {Object.entries(probs).map(([k, v]) => (
                <span key={k} style={{ marginRight: 8 }}>
                  {k}: {(v * 100).toFixed(1)}%
                </span>
              ))}
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <Table
      dataSource={diagnostics || []}
      columns={columns}
      rowKey="timestamp"
      size="small"
      pagination={{ pageSize: 10 }}
      scroll={{ x: 800 }}
      style={{ background: 'transparent' }}
    />
  );
}
