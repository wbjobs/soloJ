import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const parseSQL = (sql, targetTable) =>
  api.post('/parse/sql', { sql, target_table: targetTable });

export const storeLineage = (sql, targetTable, jobId) =>
  api.post('/lineage/store', { sql, target_table: targetTable, job_id: jobId });

export const getTables = () => api.get('/tables');

export const getTableColumns = (tableName) => api.get(`/tables/${tableName}/columns`);

export const getColumnLineage = (tableName, columnName, direction = 'both') =>
  api.get('/lineage/column', {
    params: { table_name: tableName, column_name: columnName, direction },
  });

export const getFullLineage = (depth = 5) =>
  api.get('/lineage/graph', { params: { depth } });

export const analyzeImpact = (tableName, columnName) =>
  api.post('/impact/analyze', { table_name: tableName, column_name: columnName });

export const analyzeTableImpact = (tableName) =>
  api.post('/impact/analyze', { table_name: tableName });

export const getImpactSummary = (tableName, columnName) =>
  api.get('/impact/summary', { params: { table_name: tableName, column_name: columnName } });

export const batchImpactAnalysis = (changes) =>
  api.post('/impact/batch', { changes });

export const getTransformationDetails = (sourceId, targetId) =>
  api.get('/transformation', { params: { source_id: sourceId, target_id: targetId } });

export const clearAllData = () => api.delete('/data/clear');

export default api;
