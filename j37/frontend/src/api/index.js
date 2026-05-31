import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export const uploadVibration = (data) => api.post('/upload', data);

export const getWaveform = (params) => api.post('/waveform', params);

export const getSpectrum = (params) => api.post('/spectrum', params);

export const getCWT = (params) => api.post('/cwt', params);

export const getFeatures = (params) => api.post('/features', params);

export const getDiagnostics = (params) => api.post('/diagnostics', params);

export const compareRegion = (params) => api.post('/region-compare', params);

export const detectAnomaly = (params) => api.post('/detect', params);

export const trainModel = (params) => api.post('/train', params);

export const causalInference = (params) => api.post('/causal-inference', params);

export const labelSample = (params) => api.post('/label-sample', params);

export const getLabeledSamples = (sensorId, includeUsed = false, limit = 100) =>
  api.get(`/labeled-samples/${sensorId}?include_used=${includeUsed}&limit=${limit}`);

export const incrementalTrain = (params) => api.post('/incremental-train', params);

export const getModelHistory = (sensorId) => api.get(`/model-history/${sensorId}`);

export const getTrainingLogs = (sensorId, limit = 50) =>
  api.get(`/training-logs/${sensorId}?limit=${limit}`);

export const getModelStats = (sensorId) => api.get(`/model-stats/${sensorId}`);

export default api;
