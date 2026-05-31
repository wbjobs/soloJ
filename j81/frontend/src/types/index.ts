export type SensorStatus = 'normal' | 'warning' | 'error';

export interface SensorData {
  workshop: string;
  sensorId: string;
  temperature: number;
  vibration: number;
  voltage: number;
  timestamp: string;
  consecutiveErrors?: number;
  isAlerting?: boolean;
  alertType?: string;
  alertValue?: number;
  alertThreshold?: number;
  status?: SensorStatus;
  history?: {
    temperature: number[];
    vibration: number[];
    voltage: number[];
    timestamps: string[];
  };
}

export interface WorkshopData {
  id: string;
  name: string;
  sensors: string[];
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface AlertRecord {
  id: string;
  sensorId: string;
  workshop: string;
  type: 'temperature' | 'vibration' | 'voltage';
  status: 'warning' | 'error';
  value: number;
  threshold: number;
  timestamp: string;
}

export const TEMPERATURE_WARNING = 40;
export const TEMPERATURE_ERROR = 50;
export const VIBRATION_WARNING = 100;
export const VIBRATION_ERROR = 150;
export const VOLTAGE_WARNING_HIGH = 240;
export const VOLTAGE_WARNING_LOW = 200;
export const VOLTAGE_ERROR_HIGH = 250;
export const VOLTAGE_ERROR_LOW = 190;

export interface SensorStats {
  avgTemperature: number;
  avgVibration: number;
  avgVoltage: number;
  errorCount: number;
  warningCount: number;
  normalCount: number;
}
