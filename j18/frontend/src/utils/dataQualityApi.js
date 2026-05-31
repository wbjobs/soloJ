import api from './api';

export const dataQualityApi = {
  storeQualityMetrics: async (tableName, columnName, metrics) => {
    const response = await api.post('/quality/metrics/store', {
      table_name: tableName,
      column_name: columnName,
      metrics,
    });
    return response.data;
  },

  getQualityMetrics: async (tableName, columnName) => {
    const response = await api.get('/quality/metrics', {
      params: { table_name: tableName, column_name: columnName },
    });
    return response.data;
  },

  generateAlerts: async (tableName, columnName, metrics) => {
    const response = await api.post('/quality/generate-alerts', {
      table_name: tableName,
      column_name: columnName,
      metrics,
    });
    return response.data;
  },

  getQualityAlerts: async (tableName = null, alertLevel = null) => {
    const params = {};
    if (tableName) params.table_name = tableName;
    if (alertLevel) params.alert_level = alertLevel;
    const response = await api.get('/quality/alerts', { params });
    return response.data;
  },

  getColumnsWithAlerts: async () => {
    const response = await api.get('/quality/columns-with-alerts');
    return response.data;
  },

  analyzeAnomalyPropagation: async (tableName, columnName, anomalyRate = 0.15) => {
    const response = await api.post('/quality/anomaly-propagation', {
      table_name: tableName,
      column_name: columnName,
      source_anomaly_rate: anomalyRate,
    });
    return response.data;
  },

  batchAnomalyPropagation: async (sources, maxDepth = 10) => {
    const response = await api.post('/quality/batch-propagation', {
      sources,
      max_depth: maxDepth,
    });
    return response.data;
  },

  getAnomalyVisualization: async (tableName, columnName, anomalyRate = 0.15) => {
    const response = await api.get('/quality/anomaly-visualization', {
      params: {
        table_name: tableName,
        column_name: columnName,
        source_anomaly_rate: anomalyRate,
      },
    });
    return response.data;
  },

  simulateQualityMetrics: async (tableName, columns) => {
    const response = await api.get('/quality/simulate', {
      params: { table_name: tableName, columns: columns.join(',') },
    });
    return response.data;
  },
};

export const getAlertColor = (level) => {
  const colors = {
    info: '#1890ff',
    warning: '#faad14',
    critical: '#fa8c16',
    fatal: '#f5222d',
  };
  return colors[level] || '#999';
};

export const getQualityColor = (score) => {
  if (score >= 0.9) return '#52c41a';
  if (score >= 0.7) return '#faad14';
  if (score >= 0.5) return '#fa8c16';
  return '#f5222d';
};

export const getAnomalyRateColor = (rate) => {
  if (rate >= 0.2) return '#f5222d';
  if (rate >= 0.1) return '#fa8c16';
  if (rate >= 0.05) return '#faad14';
  return '#52c41a';
};

export default dataQualityApi;
