import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ModbusService } from './modbus/modbus.service';
import { GrpcClientService } from './grpc/grpc-client.service';
import { PollingService } from './polling/polling.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ModbusService, GrpcClientService, PollingService],
})
export class AppModule {}
