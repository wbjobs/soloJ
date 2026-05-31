import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import ModbusRTU from 'modbus-serial';

export interface RegisterData {
  address: number;
  value: number;
  name: string;
}

@Injectable()
export class ModbusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModbusService.name);
  private client: ModbusRTU;
  private isConnected = false;
  private useSimulation = true;
  private isReconnecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = Infinity;
  private readonly BASE_RECONNECT_DELAY_MS = 1000;
  private readonly MAX_RECONNECT_DELAY_MS = 30000;
  private consecutiveReadFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;

  private readonly registerNames: Map<number, string> = new Map([
    [0, 'Temperature_Sensor_1'],
    [1, 'Temperature_Sensor_2'],
    [2, 'Pressure_Sensor_1'],
    [3, 'Pressure_Sensor_2'],
    [4, 'Flow_Rate'],
    [5, 'Motor_Speed'],
    [6, 'Motor_Current'],
    [7, 'Valve_Position'],
    [8, 'Energy_Consumption'],
    [9, 'System_Status'],
  ]);

  async onModuleInit() {
    this.client = new ModbusRTU();
    await this.connect();
  }

  onModuleDestroy() {
    this.cancelReconnect();
    this.closeConnection();
  }

  private closeConnection() {
    try {
      if (this.client && this.client.isOpen) {
        this.client.close(() => {
          this.logger.log('Modbus client connection closed');
        });
      }
    } catch (error) {
      this.logger.warn(`Error closing Modbus client: ${error.message}`);
    }
    this.isConnected = false;
  }

  private async connect() {
    const host = process.env.MODBUS_HOST || '127.0.0.1';
    const port = parseInt(process.env.MODBUS_PORT || '502');
    const slaveId = parseInt(process.env.MODBUS_SLAVE_ID || '1');

    try {
      if (this.client && this.client.isOpen) {
        this.client.close();
      }
    } catch {
      // ignore close errors on stale connection
    }

    this.client = new ModbusRTU();

    try {
      await this.client.connectTCP(host, { port });
      this.client.setID(slaveId);
      this.isConnected = true;
      this.useSimulation = false;
      this.reconnectAttempts = 0;
      this.consecutiveReadFailures = 0;
      this.logger.log(`Connected to Modbus TCP device at ${host}:${port}, slave ID: ${slaveId}`);
    } catch (error) {
      this.isConnected = false;
      this.useSimulation = true;
      this.logger.warn(`Failed to connect to real PLC: ${error.message}`);
      this.logger.log('Starting in SIMULATION mode - generating simulated PLC data');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isReconnecting) {
      return;
    }

    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error(`Max reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached, giving up`);
      return;
    }

    this.isReconnecting = true;
    this.cancelReconnect();

    const delay = Math.min(
      this.BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY_MS,
    );

    const jitter = Math.random() * 500;
    const totalDelay = delay + jitter;

    this.logger.log(
      `Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${Math.round(totalDelay)}ms ` +
      `(backoff: ${delay}ms + jitter: ${Math.round(jitter)}ms)`,
    );

    this.reconnectTimer = setTimeout(async () => {
      this.isReconnecting = false;
      this.reconnectAttempts++;
      this.logger.log(`Attempting to reconnect to PLC (attempt #${this.reconnectAttempts})...`);

      try {
        await this.connect();

        if (this.isConnected) {
          this.logger.log('✓ Successfully reconnected to PLC device!');
        } else {
          this.scheduleReconnect();
        }
      } catch (error) {
        this.logger.error(`Reconnect attempt failed: ${error.message}`);
        this.scheduleReconnect();
      }
    }, totalDelay);
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleReadFailure(error: any) {
    this.consecutiveReadFailures++;
    this.logger.error(
      `Error reading registers (failure ${this.consecutiveReadFailures}/${this.MAX_CONSECUTIVE_FAILURES}): ${error.message}`,
    );

    if (this.consecutiveReadFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.logger.warn(
        `${this.MAX_CONSECUTIVE_FAILURES} consecutive read failures detected, marking connection as lost`,
      );
      this.isConnected = false;
      this.useSimulation = true;
      this.closeConnection();
      this.scheduleReconnect();
    }
  }

  private handleReadSuccess() {
    if (this.consecutiveReadFailures > 0) {
      this.logger.log('Read succeeded, resetting failure counter');
      this.consecutiveReadFailures = 0;
    }
  }

  async readHoldingRegisters(
    startAddress: number,
    count: number,
  ): Promise<RegisterData[]> {
    if (this.useSimulation) {
      return this.generateSimulatedData(startAddress, count);
    }

    try {
      const result = await this.client.readHoldingRegisters(startAddress, count);
      const registers: RegisterData[] = [];

      for (let i = 0; i < result.data.length; i++) {
        const address = startAddress + i;
        registers.push({
          address,
          value: result.data[i],
          name: this.registerNames.get(address) || `Register_${address}`,
        });
      }

      this.handleReadSuccess();
      return registers;
    } catch (error) {
      this.handleReadFailure(error);
      return this.generateSimulatedData(startAddress, count);
    }
  }

  private generateSimulatedData(
    startAddress: number,
    count: number,
  ): RegisterData[] {
    const registers: RegisterData[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < count; i++) {
      const address = startAddress + i;
      let value: number;

      switch (address) {
        case 0:
        case 1:
          value = Math.floor(25 + Math.sin(timestamp / 5000 + address) * 10);
          break;
        case 2:
        case 3:
          value = Math.floor(100 + Math.sin(timestamp / 3000 + address) * 20);
          break;
        case 4:
          value = Math.floor(50 + Math.abs(Math.sin(timestamp / 4000)) * 50);
          break;
        case 5:
          value = Math.floor(1500 + Math.sin(timestamp / 2000) * 300);
          break;
        case 6:
          value = Math.floor(10 + Math.abs(Math.sin(timestamp / 2500)) * 15);
          break;
        case 7:
          value = Math.floor(50 + Math.sin(timestamp / 6000) * 50);
          break;
        case 8:
          value = Math.floor(1000 + (timestamp / 1000) % 1000);
          break;
        case 9:
          value = Math.floor(1 + Math.random() * 3);
          break;
        default:
          value = Math.floor(Math.random() * 1000);
      }

      registers.push({
        address,
        value,
        name: this.registerNames.get(address) || `Register_${address}`,
      });
    }

    return registers;
  }

  getConnectionStatus(): { connected: boolean; simulation: boolean; reconnecting: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      simulation: this.useSimulation,
      reconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}
