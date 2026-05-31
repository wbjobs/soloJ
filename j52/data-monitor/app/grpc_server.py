import grpc
from concurrent import futures
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

try:
    from grpc_gen import modbus_pb2, modbus_pb2_grpc
except ImportError:
    print("Warning: Generated gRPC code not found. Run 'python generate_grpc.py' first.")
    print("Using fallback direct protobuf parsing...")
    modbus_pb2 = None
    modbus_pb2_grpc = None

from .influxdb_service import influxdb_service
from .config import settings

logger = logging.getLogger(__name__)


class ModbusDataService(modbus_pb2_grpc.ModbusDataServiceServicer if modbus_pb2_grpc else object):
    def __init__(self):
        self.received_count = 0

    def SendData(self, request, context):
        try:
            self.received_count += 1
            
            registers = []
            for reg in request.registers:
                registers.append({
                    "address": reg.address,
                    "value": reg.value,
                    "name": reg.name,
                })

            success = influxdb_service.write_modbus_data(
                device_id=request.device_id,
                device_name=request.device_name,
                timestamp=request.timestamp,
                registers=registers,
            )

            logger.info(
                f"Received data from {request.device_id}: "
                f"{len(registers)} registers, "
                f"written_to_db={success}, "
                f"total_received={self.received_count}"
            )

            return modbus_pb2.StreamResponse(
                success=success,
                message="Data received successfully" if success else "Failed to write to database",
                received_count=self.received_count,
            )
        except Exception as e:
            logger.error(f"Error in SendData: {e}")
            return modbus_pb2.StreamResponse(
                success=False,
                message=f"Error: {str(e)}",
                received_count=self.received_count,
            )

    def SendDataStream(self, request_iterator, context):
        try:
            for request in request_iterator:
                self.received_count += 1

                registers = []
                for reg in request.registers:
                    registers.append({
                        "address": reg.address,
                        "value": reg.value,
                        "name": reg.name,
                    })

                success = influxdb_service.write_modbus_data(
                    device_id=request.device_id,
                    device_name=request.device_name,
                    timestamp=request.timestamp,
                    registers=registers,
                )

                logger.debug(
                    f"Stream data from {request.device_id}: "
                    f"{len(registers)} registers, "
                    f"written_to_db={success}"
                )

                if self.received_count % 10 == 0:
                    logger.info(
                        f"Stream progress: {self.received_count} messages received, "
                        f"last device: {request.device_id}"
                    )

            return modbus_pb2.StreamResponse(
                success=True,
                message="Stream completed successfully",
                received_count=self.received_count,
            )
        except Exception as e:
            logger.error(f"Error in SendDataStream: {e}")
            return modbus_pb2.StreamResponse(
                success=False,
                message=f"Error: {str(e)}",
                received_count=self.received_count,
            )


def serve_grpc():
    if modbus_pb2_grpc is None:
        logger.error("Cannot start gRPC server: generated code not available")
        logger.error("Please run: python generate_grpc.py")
        return None

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    modbus_pb2_grpc.add_ModbusDataServiceServicer_to_server(
        ModbusDataService(), server
    )
    
    listen_addr = f"{settings.grpc_host}:{settings.grpc_port}"
    server.add_insecure_port(listen_addr)
    server.start()
    
    logger.info(f"gRPC server started on {listen_addr}")
    return server
