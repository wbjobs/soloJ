import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ModbusService, RegisterData } from '../modbus/modbus.service';
import { GrpcClientService, ModbusDataMessage } from '../grpc/grpc-client.service';

@Injectable()
export class PollingService implements OnModuleInit {
  private readonly logger = new Logger(PollingService.name);
  private pollInterval: number;
  private registerStart: number;
  private registerCount: number;
  private deviceId: string;
  private deviceName: string;
  private useStream: boolean = true;

  constructor(
    private readonly modbusService: ModbusService,
    private readonly grpcClientService: GrpcClientService,
  ) {}

  async onModuleInit() {
    this.pollInterval = parseInt(process.env.POLL_INTERVAL_MS || '1000');
    this.registerStart = parseInt(process.env.REGISTER_START || '0');
    this.registerCount = parseInt(process.env.REGISTER_COUNT || '10');
    this.deviceId = process.env.DEVICE_ID || 'plc-001';
    this.deviceName = process.env.DEVICE_NAME || 'Industrial_PLC_Line_A';

    this.logger.log(`Polling configuration:`);
    this.logger.log(`  Device ID: ${this.deviceId}`);
    this.logger.log(`  Device Name: ${this.deviceName}`);
    this.logger.log(`  Poll interval: ${this.pollInterval}ms`);
    this.logger.log(`  Register range: ${this.registerStart} - ${this.registerStart + this.registerCount - 1}`);
    this.logger.log(`  Using gRPC stream: ${this.useStream}`);

    const status = this.modbusService.getConnectionStatus();
    this.logger.log(
      `Connection status: connected=${status.connected}, simulation=${status.simulation}, ` +
      `reconnecting=${status.reconnecting}`,
    );

    if (this.useStream) {
      this.grpcClientService.startStream();
    }
  }

  @Cron(CronExpression.EVERY_SECOND)
  async pollData() {
    try {
      const registers = await this.modbusService.readHoldingRegisters(
        this.registerStart,
        this.registerCount,
      );

      const data: ModbusDataMessage = {
        device_id: this.deviceId,
        device_name: this.deviceName,
        timestamp: Date.now(),
        registers,
      };

      if (this.useStream) {
        this.grpcClientService.sendStreamData(data);
      } else {
        const success = await this.grpcClientService.sendData(data);
        if (!success) {
          this.logger.warn('Failed to send data via gRPC');
        }
      }

      this.logData(registers);
    } catch (error) {
      this.logger.error(`Polling error: ${error.message}`);
    }
  }

  private logData(registers: RegisterData[]) {
    const dataStr = registers
      .map((r) => `${r.name}=${r.value}`)
      .join(', ');
    this.logger.debug(`Polled: ${dataStr}`);
  }
}
