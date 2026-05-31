from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime
import asyncio
import json
import logging

from .config import settings
from .influxdb_service import influxdb_service

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Modbus Data Monitor API",
    description="Industrial IoT Data Monitoring Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterData(BaseModel):
    address: int
    value: int
    name: str


class ModbusDataResponse(BaseModel):
    time: str
    device_id: str
    device_name: str
    register_address: int
    register_name: str
    value: int


class DeviceInfo(BaseModel):
    device_id: str
    device_name: str


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    grpc_server: str
    influxdb: str


class StatsResponse(BaseModel):
    total_devices: int
    total_points: int
    latest_update: Optional[str]


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    influxdb_status = "connected" if influxdb_service.client else "disconnected"
    
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        grpc_server=f"{settings.grpc_host}:{settings.grpc_port}",
        influxdb=influxdb_status,
    )


@app.get("/api/devices", response_model=List[DeviceInfo])
async def get_devices():
    try:
        devices = influxdb_service.get_device_list()
        return devices
    except Exception as e:
        logger.error(f"Error getting devices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/data/latest", response_model=List[ModbusDataResponse])
async def get_latest_data(
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
):
    try:
        data = influxdb_service.get_latest_data(device_id=device_id)
        return data
    except Exception as e:
        logger.error(f"Error getting latest data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/data/history/{register_name}")
async def get_history_data(
    register_name: str,
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    time_range: str = Query("-1h", description="Time range, e.g., -1h, -24h, -7d"),
):
    try:
        data = influxdb_service.get_history_data(
            register_name=register_name,
            start_time=time_range,
            device_id=device_id,
        )
        return {
            "register_name": register_name,
            "time_range": time_range,
            "data_points": len(data),
            "data": data,
        }
    except Exception as e:
        logger.error(f"Error getting history data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats():
    try:
        devices = influxdb_service.get_device_list()
        latest_data = influxdb_service.get_latest_data()
        
        latest_update = None
        if latest_data:
            latest_update = latest_data[0]["time"] if latest_data else None
        
        return StatsResponse(
            total_devices=len(devices),
            total_points=len(latest_data),
            latest_update=latest_update,
        )
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/registers")
async def get_register_list(
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
):
    try:
        data = influxdb_service.get_latest_data(device_id=device_id)
        registers = []
        for item in data:
            registers.append({
                "address": item["register_address"],
                "name": item["register_name"],
                "current_value": item["value"],
                "last_update": item["time"],
            })
        return sorted(registers, key=lambda x: x["address"])
    except Exception as e:
        logger.error(f"Error getting register list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/playback")
async def websocket_playback(websocket: WebSocket):
    await websocket.accept()
    logger.info("Playback WebSocket client connected")

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            command = msg.get("command")

            if command == "start":
                start_time = msg.get("start_time")
                stop_time = msg.get("stop_time")
                register_names = msg.get("register_names")
                device_id = msg.get("device_id")
                speed = msg.get("speed", 10)

                if not start_time or not stop_time:
                    await websocket.send_json({
                        "type": "error",
                        "message": "start_time and stop_time are required",
                    })
                    continue

                logger.info(
                    f"Playback request: {start_time} -> {stop_time}, "
                    f"registers={register_names}, speed={speed}x"
                )

                await _run_playback(
                    websocket,
                    start_time,
                    stop_time,
                    register_names,
                    device_id,
                    speed,
                )

            elif command == "stop":
                await websocket.send_json({"type": "stopped"})

    except WebSocketDisconnect:
        logger.info("Playback WebSocket client disconnected")
    except Exception as e:
        logger.error(f"Playback WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


async def _run_playback(
    websocket: WebSocket,
    start_time: str,
    stop_time: str,
    register_names: Optional[List[str]],
    device_id: Optional[str],
    speed: int,
):
    grouped_data = influxdb_service.get_playback_data(
        start_time=start_time,
        stop_time=stop_time,
        register_names=register_names,
        device_id=device_id,
    )

    if not grouped_data:
        await websocket.send_json({
            "type": "error",
            "message": "No data found for the specified time range",
        })
        return

    all_points: List[Dict] = []
    for reg_name, points in grouped_data.items():
        for pt in points:
            all_points.append({
                "timestamp_ms": pt["timestamp_ms"],
                "register_name": reg_name,
                "value": pt["value"],
                "time": pt["time"],
            })

    all_points.sort(key=lambda p: p["timestamp_ms"])

    total_points = len(all_points)
    time_span_ms = all_points[-1]["timestamp_ms"] - all_points[0]["timestamp_ms"] if total_points > 1 else 0
    real_duration_ms = time_span_ms / speed if speed > 0 else time_span_ms

    await websocket.send_json({
        "type": "meta",
        "total_points": total_points,
        "time_span_ms": time_span_ms,
        "real_duration_ms": real_duration_ms,
        "speed": speed,
        "register_names": list(grouped_data.keys()),
    })

    if total_points == 0:
        return

    base_ts = all_points[0]["timestamp_ms"]
    batch: List[Dict] = []
    last_sent_ts = base_ts

    BATCH_INTERVAL_MS = 100

    for i, point in enumerate(all_points):
        batch.append({
            "register_name": point["register_name"],
            "value": point["value"],
            "time": point["time"],
            "timestamp_ms": point["timestamp_ms"],
        })

        current_virtual_offset = (point["timestamp_ms"] - base_ts) / speed
        elapsed_real = current_virtual_offset - (last_sent_ts - base_ts) / speed

        if elapsed_real >= BATCH_INTERVAL_MS or i == total_points - 1:
            if batch:
                try:
                    await websocket.send_json({
                        "type": "data",
                        "points": batch,
                        "progress": i + 1,
                        "total": total_points,
                    })
                except Exception:
                    return

                wait_seconds = (elapsed_real / 1000.0) if speed > 0 else 0.1
                await asyncio.sleep(min(wait_seconds, 0.1))

                last_sent_ts = point["timestamp_ms"]
                batch = []

    await websocket.send_json({"type": "done", "total_points": total_points})
