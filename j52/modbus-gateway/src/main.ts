import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('ModbusGateway');
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Modbus TCP Gateway Service is running on port ${port}`);
  logger.log(`gRPC client connected to ${process.env.GRPC_SERVER_URL || 'localhost:50051'}`);
}

bootstrap();
