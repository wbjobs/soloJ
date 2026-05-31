import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { RegisterData } from '../modbus/modbus.service';

export interface ModbusDataMessage {
  device_id: string;
  device_name: string;
  timestamp: number;
  registers: RegisterData[];
}

interface PendingWrite {
  data: ModbusDataMessage;
  timestamp: number;
}

@Injectable()
export class GrpcClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GrpcClientService.name);
  private client: any;
  private call: any;
  private packageDefinition: any;
  private modbusProto: any;

  private isDraining = false;
  private pendingWrites: PendingWrite[] = [];
  private readonly MAX_PENDING_WRITES = 50;
  private readonly PENDING_WRITE_TTL_MS = 5000;
  private streamRestartCount = 0;
  private totalMessagesSent = 0;
  private totalMessagesDropped = 0;
  private lastDrainTime = 0;
  private readonly DRAIN_COOLDOWN_MS = 1000;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly HEALTH_CHECK_INTERVAL_MS = 10000;
  private isShuttingDown = false;

  async onModuleInit() {
    await this.initGrpcClient();
    this.startHealthCheck();
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    this.stopHealthCheck();
    this.destroyStream();
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  private async initGrpcClient() {
    const protoPath = path.join(__dirname, '../../proto/modbus.proto');

    this.packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    this.modbusProto = grpc.loadPackageDefinition(this.packageDefinition).modbus;

    const serverUrl = process.env.GRPC_SERVER_URL || 'localhost:50051';
    this.client = new this.modbusProto.ModbusDataService(
      serverUrl,
      grpc.credentials.createInsecure(),
      {
        'grpc.max_send_message_length': 4 * 1024 * 1024,
        'grpc.max_receive_message_length': 4 * 1024 * 1024,
        'grpc.keepalive_time_ms': 30000,
        'grpc.keepalive_timeout_ms': 10000,
        'grpc.keepalive_permit_without_calls': 1,
      },
    );

    this.logger.log(`gRPC client initialized, connecting to ${serverUrl}`);
  }

  async sendData(data: ModbusDataMessage): Promise<boolean> {
    if (this.isShuttingDown) {
      return false;
    }

    return new Promise((resolve) => {
      const grpcData = this.serializeModbusData(data);

      this.client.SendData(grpcData, (error: any, response: any) => {
        if (error) {
          this.logger.error(`gRPC SendData error: ${error.message}`);
          resolve(false);
        } else {
          this.totalMessagesSent++;
          this.logger.debug(
            `Data sent successfully, received count: ${response.received_count}`,
          );
          resolve(response.success);
        }
      });
    });
  }

  startStream(): void {
    if (this.call) {
      this.logger.warn('Stream already active, destroying existing stream first');
      this.destroyStream();
    }

    if (this.isShuttingDown) {
      return;
    }

    this.streamRestartCount++;
    this.isDraining = false;

    try {
      this.call = this.client.SendDataStream((error: any, response: any) => {
        if (error) {
          this.logger.error(`gRPC stream callback error: ${error.message}`);
          this.scheduleStreamRestart();
        } else {
          this.logger.log(
            `Stream response: success=${response.success}, count=${response.received_count}`,
          );
        }
      });

      this.call.on('end', () => {
        this.logger.log('gRPC stream ended by server');
        this.call = null;
        this.isDraining = false;
        if (!this.isShuttingDown) {
          this.scheduleStreamRestart();
        }
      });

      this.call.on('error', (error: any) => {
        this.logger.error(`Stream error event: ${error.message}`);
        this.call = null;
        this.isDraining = false;
        if (!this.isShuttingDown) {
          this.scheduleStreamRestart();
        }
      });

      this.call.on('close', () => {
        this.logger.log('gRPC stream closed');
        this.call = null;
        this.isDraining = false;
      });

      this.logger.log(
        `gRPC bidirectional stream started (restart #${this.streamRestartCount})`,
      );

      if (this.pendingWrites.length > 0) {
        this.flushPendingWrites();
      }
    } catch (error) {
      this.logger.error(`Failed to start stream: ${error.message}`);
      this.call = null;
      this.scheduleStreamRestart();
    }
  }

  private scheduleStreamRestart() {
    if (this.isShuttingDown) {
      return;
    }

    this.destroyStream();

    const delay = Math.min(1000 * Math.pow(2, Math.min(this.streamRestartCount, 5)), 30000);
    const jitter = Math.random() * 500;

    setTimeout(() => {
      if (!this.isShuttingDown && !this.call) {
        this.logger.log('Attempting stream restart...');
        this.startStream();
      }
    }, delay + jitter);
  }

  private destroyStream() {
    if (this.call) {
      try {
        this.call.removeAllListeners();
      } catch {
        // ignore cleanup errors
      }

      try {
        if (this.call.writable) {
          this.call.end();
        } else {
          this.call.destroy();
        }
      } catch {
        // stream may already be closed
      }

      this.call = null;
      this.isDraining = false;
    }
  }

  sendStreamData(data: ModbusDataMessage): void {
    if (this.isShuttingDown) {
      return;
    }

    if (!this.call) {
      this.startStream();
    }

    if (!this.call || !this.call.writable) {
      this.bufferWrite(data);
      return;
    }

    if (this.isDraining) {
      this.bufferWrite(data);
      return;
    }

    const grpcData = this.serializeModbusData(data);

    try {
      const canWrite = this.call.write(grpcData);

      if (!canWrite) {
        this.isDraining = true;
        this.logger.warn('Stream backpressure: write returned false, buffering until drain');

        this.call.once('drain', () => {
          this.isDraining = false;
          this.lastDrainTime = Date.now();
          this.logger.log('Stream drained, flushing pending writes');
          this.flushPendingWrites();
        });
      } else {
        this.totalMessagesSent++;
      }
    } catch (error) {
      this.logger.error(`Stream write error: ${error.message}`);
      this.bufferWrite(data);
    }
  }

  private bufferWrite(data: ModbusDataMessage): void {
    if (this.pendingWrites.length >= this.MAX_PENDING_WRITES) {
      const dropped = this.pendingWrites.splice(
        0,
        this.pendingWrites.length - this.MAX_PENDING_WRITES + 1,
      );
      this.totalMessagesDropped += dropped.length;
      this.logger.warn(
        `Pending buffer full, dropped ${dropped.length} oldest messages (total dropped: ${this.totalMessagesDropped})`,
      );
    }

    this.pendingWrites.push({
      data,
      timestamp: Date.now(),
    });
  }

  private flushPendingWrites(): void {
    if (!this.call || !this.call.writable || this.isDraining) {
      return;
    }

    const now = Date.now();
    const validWrites = this.pendingWrites.filter(
      (pw) => now - pw.timestamp < this.PENDING_WRITE_TTL_MS,
    );
    const expiredCount = this.pendingWrites.length - validWrites.length;

    if (expiredCount > 0) {
      this.totalMessagesDropped += expiredCount;
      this.logger.warn(`Dropped ${expiredCount} expired pending writes`);
    }

    this.pendingWrites = [];

    for (const pw of validWrites) {
      if (!this.call || !this.call.writable) {
        this.pendingWrites.push(pw);
        break;
      }

      if (this.isDraining) {
        this.pendingWrites.push(pw);
        break;
      }

      const grpcData = this.serializeModbusData(pw.data);

      try {
        const canWrite = this.call.write(grpcData);
        this.totalMessagesSent++;

        if (!canWrite) {
          this.isDraining = true;
          this.pendingWrites = validWrites.slice(validWrites.indexOf(pw) + 1);
          this.logger.warn(
            `Backpressure during flush, ${this.pendingWrites.length} writes remaining`,
          );

          this.call.once('drain', () => {
            this.isDraining = false;
            this.lastDrainTime = Date.now();
            this.flushPendingWrites();
          });
          return;
        }
      } catch (error) {
        this.logger.error(`Flush write error: ${error.message}`);
        this.bufferWrite(pw.data);
        return;
      }
    }
  }

  private serializeModbusData(data: ModbusDataMessage) {
    return {
      device_id: data.device_id,
      device_name: data.device_name,
      timestamp: data.timestamp,
      registers: data.registers.map((r) => ({
        address: r.address,
        value: r.value,
        name: r.name,
      })),
    };
  }

  private startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      if (this.isShuttingDown) {
        return;
      }

      const stats = this.getStreamStats();
      this.logger.log(
        `Stream health: sent=${stats.totalSent}, dropped=${stats.totalDropped}, ` +
        `pending=${stats.pendingBufferSize}, restarts=${stats.restartCount}, ` +
        `draining=${stats.isDraining}`,
      );

      if (!this.call && !this.isShuttingDown) {
        this.logger.warn('Stream is not active, attempting restart');
        this.startStream();
      }
    }, this.HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  endStream(): void {
    this.destroyStream();
    this.logger.log('gRPC stream ended by client');
  }

  getStreamStats() {
    return {
      totalSent: this.totalMessagesSent,
      totalDropped: this.totalMessagesDropped,
      pendingBufferSize: this.pendingWrites.length,
      restartCount: this.streamRestartCount,
      isDraining: this.isDraining,
      isCallActive: !!this.call,
      isCallWritable: this.call?.writable ?? false,
    };
  }
}
