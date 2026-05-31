import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import type { SensorData, AlertRecord, SensorStats, SensorStatus } from '@/types';
import {
  TEMPERATURE_WARNING,
  TEMPERATURE_ERROR,
  VIBRATION_WARNING,
  VIBRATION_ERROR,
  VOLTAGE_WARNING_HIGH,
  VOLTAGE_WARNING_LOW,
  VOLTAGE_ERROR_HIGH,
  VOLTAGE_ERROR_LOW,
} from '@/types';
import { getWorkshops, getLatestData, getHistoryData } from '@/api/client';

const REFRESH_INTERVAL = 3000;
const DEBOUNCE_DELAY = 100;
const MAX_HISTORY_POINTS = 30;
const DATA_TIMEOUT = 60000;

const workshops = ref<string[]>([]);
const latestData = ref<SensorData[]>([]);
const historyData = ref<SensorData[]>([]);
const alerts = ref<AlertRecord[]>([]);
const loading = ref(false);
const selectedWorkshop = ref<string | null>(null);
const refreshTimer = ref<ReturnType<typeof setInterval> | null>(null);
const sensorHistoryCache = ref<Record<string, SensorData[]>>({});
const consecutiveErrors = ref(0);
const isRefreshing = ref(false);
const lastRefreshTime = ref<number>(0);
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);

function flattenNestedData(nested: Record<string, Record<string, SensorData>>): SensorData[] {
  const flat: SensorData[] = [];
  Object.entries(nested).forEach(([workshop, sensors]) => {
    Object.entries(sensors).forEach(([sensorId, data]) => {
      flat.push({
        ...data,
        workshop,
        sensorId,
      });
    });
  });
  return flat;
}

function validateSensorData(data: SensorData): boolean {
  if (!data.workshop || !data.sensorId) return false;
  if (typeof data.temperature !== 'number' || isNaN(data.temperature)) return false;
  if (typeof data.vibration !== 'number' || isNaN(data.vibration)) return false;
  if (typeof data.voltage !== 'number' || isNaN(data.voltage)) return false;
  if (!data.timestamp) return false;
  
  const dataTime = new Date(data.timestamp).getTime();
  const now = Date.now();
  if (dataTime > now + 60000 || dataTime < now - DATA_TIMEOUT) {
    return false;
  }
  
  return true;
}

function determineStatus(data: SensorData): SensorStatus {
  const { temperature, vibration, voltage } = data;
  let status: SensorStatus = 'normal';

  if (
    temperature >= TEMPERATURE_ERROR ||
    vibration >= VIBRATION_ERROR ||
    voltage >= VOLTAGE_ERROR_HIGH ||
    voltage <= VOLTAGE_ERROR_LOW
  ) {
    status = 'error';
  } else if (
    temperature >= TEMPERATURE_WARNING ||
    vibration >= VIBRATION_WARNING ||
    voltage >= VOLTAGE_WARNING_HIGH ||
    voltage <= VOLTAGE_WARNING_LOW
  ) {
    status = 'warning';
  }

  return status;
}

function generateAlerts(data: SensorData[]): AlertRecord[] {
  const newAlerts: AlertRecord[] = [];

  data.forEach((sensor) => {
    const { temperature, vibration, voltage, sensorId, workshop, timestamp } = sensor;

    if (temperature >= TEMPERATURE_ERROR) {
      newAlerts.push({
        id: `${sensorId}-temp-${Date.now()}-${Math.random()}`,
        sensorId,
        workshop,
        type: 'temperature',
        status: 'error',
        value: temperature,
        threshold: TEMPERATURE_ERROR,
        timestamp,
      });
    } else if (temperature >= TEMPERATURE_WARNING) {
      newAlerts.push({
        id: `${sensorId}-temp-${Date.now()}-${Math.random()}`,
        sensorId,
        workshop,
        type: 'temperature',
        status: 'warning',
        value: temperature,
        threshold: TEMPERATURE_WARNING,
        timestamp,
      });
    }

    if (vibration >= VIBRATION_ERROR) {
      newAlerts.push({
        id: `${sensorId}-vib-${Date.now()}-${Math.random()}`,
        sensorId,
        workshop,
        type: 'vibration',
        status: 'error',
        value: vibration,
        threshold: VIBRATION_ERROR,
        timestamp,
      });
    } else if (vibration >= VIBRATION_WARNING) {
      newAlerts.push({
        id: `${sensorId}-vib-${Date.now()}-${Math.random()}`,
        sensorId,
        workshop,
        type: 'vibration',
        status: 'warning',
        value: vibration,
        threshold: VIBRATION_WARNING,
        timestamp,
      });
    }

    if (voltage >= VOLTAGE_ERROR_HIGH || voltage <= VOLTAGE_ERROR_LOW) {
      newAlerts.push({
        id: `${sensorId}-volt-${Date.now()}-${Math.random()}`,
        sensorId,
        workshop,
        type: 'voltage',
        status: 'error',
        value: voltage,
        threshold: voltage > 220 ? VOLTAGE_ERROR_HIGH : VOLTAGE_ERROR_LOW,
        timestamp,
      });
    } else if (voltage >= VOLTAGE_WARNING_HIGH || voltage <= VOLTAGE_WARNING_LOW) {
      newAlerts.push({
        id: `${sensorId}-volt-${Date.now()}-${Math.random()}`,
        sensorId,
        workshop,
        type: 'voltage',
        status: 'warning',
        value: voltage,
        threshold: voltage > 220 ? VOLTAGE_WARNING_HIGH : VOLTAGE_WARNING_LOW,
        timestamp,
      });
    }
  });

  return newAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

const stats = computed<SensorStats>(() => {
  const data = filteredData.value;
  if (data.length === 0) {
    return {
      avgTemperature: 0,
      avgVibration: 0,
      avgVoltage: 0,
      errorCount: 0,
      warningCount: 0,
      normalCount: 0,
    };
  }

  const totalTemp = data.reduce((sum, d) => sum + d.temperature, 0);
  const totalVib = data.reduce((sum, d) => sum + d.vibration, 0);
  const totalVolt = data.reduce((sum, d) => sum + d.voltage, 0);

  let errorCount = 0;
  let warningCount = 0;
  let normalCount = 0;

  data.forEach((d) => {
    const status = d.status || determineStatus(d);
    if (status === 'error') errorCount++;
    else if (status === 'warning') warningCount++;
    else normalCount++;
  });

  return {
    avgTemperature: parseFloat((totalTemp / data.length).toFixed(1)),
    avgVibration: parseFloat((totalVib / data.length).toFixed(1)),
    avgVoltage: parseFloat((totalVolt / data.length).toFixed(1)),
    errorCount,
    warningCount,
    normalCount,
  };
});

const workshopErrorCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  latestData.value.forEach((d) => {
    const status = d.status || determineStatus(d);
    if (status === 'error' || status === 'warning') {
      counts[d.workshop] = (counts[d.workshop] || 0) + 1;
    }
  });
  return counts;
});

const filteredData = computed(() => {
  if (!selectedWorkshop.value) {
    return latestData.value;
  }
  return latestData.value.filter((d) => d.workshop === selectedWorkshop.value);
});

function updateSensorHistory(newData: SensorData[]) {
  newData.forEach((d) => {
    const key = `${d.workshop}-${d.sensorId}`;
    if (!sensorHistoryCache.value[key]) {
      sensorHistoryCache.value[key] = [];
    }
    const history = sensorHistoryCache.value[key];
    
    const lastEntry = history[history.length - 1];
    if (lastEntry && lastEntry.timestamp === d.timestamp) {
      return;
    }
    
    history.push(d);
    if (history.length > MAX_HISTORY_POINTS) {
      history.shift();
    }
  });
}

function getSensorHistory(workshop: string, sensorId: string): SensorData[] {
  const key = `${workshop}-${sensorId}`;
  return sensorHistoryCache.value[key] || [];
}

function debouncedRefresh() {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value);
  }
  debounceTimer.value = setTimeout(() => {
    fetchLatestData();
  }, DEBOUNCE_DELAY);
}

async function fetchWorkshops() {
  try {
    const data = await getWorkshops();
    workshops.value = data;
    consecutiveErrors.value = 0;
  } catch (error) {
    console.error('Failed to fetch workshops:', error);
    consecutiveErrors.value++;
  }
}

async function fetchLatestData() {
  if (isRefreshing.value) {
    return;
  }
  
  isRefreshing.value = true;
  loading.value = true;
  
  try {
    const nestedData = await getLatestData();
    const flatData = flattenNestedData(nestedData);
    
    const validData = flatData.filter(validateSensorData);
    
    if (validData.length === 0 && flatData.length > 0) {
      console.warn('All received data failed validation, using cached data');
      consecutiveErrors.value++;
      return;
    }
    
    validData.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    latestData.value = validData.map((d) => ({
      ...d,
      status: d.isAlerting ? 'error' : determineStatus(d),
    }));
    
    updateSensorHistory(latestData.value);
    alerts.value = generateAlerts(validData);
    
    lastRefreshTime.value = Date.now();
    consecutiveErrors.value = 0;
    
  } catch (error: any) {
    console.error('Failed to fetch latest data:', error);
    consecutiveErrors.value++;
    
    if (error.response?.status === 400) {
      console.warn('Client error, will not auto-retry this request');
    }
  } finally {
    loading.value = false;
    isRefreshing.value = false;
  }
}

async function fetchHistoryData(workshop: string, sensorId: string, hours: number = 1) {
  try {
    const data = await getHistoryData(workshop, sensorId, hours);
    const validData = data.filter(validateSensorData);
    historyData.value = validData;
    return validData;
  } catch (error) {
    console.error('Failed to fetch history data:', error);
    return [];
  }
}

function selectWorkshop(workshopId: string | null) {
  selectedWorkshop.value = workshopId;
  nextTick(() => {
    debouncedRefresh();
  });
}

function startAutoRefresh() {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
  }
  refreshTimer.value = setInterval(() => {
    if (consecutiveErrors.value >= 5) {
      console.warn('Too many consecutive errors, slowing down refresh rate');
      return;
    }
    fetchLatestData();
  }, REFRESH_INTERVAL);
}

function stopAutoRefresh() {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value);
    refreshTimer.value = null;
  }
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value);
    debounceTimer.value = null;
  }
}

export function useSensorData() {
  onMounted(() => {
    fetchWorkshops();
    fetchLatestData();
    startAutoRefresh();
  });

  onUnmounted(() => {
    stopAutoRefresh();
  });

  return {
    workshops,
    latestData,
    historyData,
    alerts,
    loading,
    selectedWorkshop,
    stats,
    filteredData,
    workshopErrorCounts,
    consecutiveErrors,
    lastRefreshTime,
    fetchWorkshops,
    fetchLatestData,
    fetchHistoryData,
    selectWorkshop,
    startAutoRefresh,
    stopAutoRefresh,
    determineStatus,
    getSensorHistory,
    debouncedRefresh,
  };
}
