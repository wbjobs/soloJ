from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime
from typing import List, Dict, Optional
import logging
from .config import settings

logger = logging.getLogger(__name__)


class InfluxDBService:
    def __init__(self):
        self.client = None
        self.write_api = None
        self.query_api = None
        self._connect()

    def _connect(self):
        try:
            self.client = InfluxDBClient(
                url=settings.influxdb_url,
                token=settings.influxdb_token,
                org=settings.influxdb_org,
            )
            self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
            self.query_api = self.client.query_api()
            logger.info(f"Connected to InfluxDB at {settings.influxdb_url}")
        except Exception as e:
            logger.error(f"Failed to connect to InfluxDB: {e}")
            logger.warning("InfluxDB operations will be skipped until connection is restored")

    def write_modbus_data(
        self,
        device_id: str,
        device_name: str,
        timestamp: int,
        registers: List[Dict],
    ) -> bool:
        if not self.write_api:
            logger.warning("InfluxDB not connected, skipping write")
            return False

        try:
            dt = datetime.fromtimestamp(timestamp / 1000.0)
            points = []

            for reg in registers:
                point = (
                    Point("modbus_data")
                    .tag("device_id", device_id)
                    .tag("device_name", device_name)
                    .tag("register_address", str(reg["address"]))
                    .tag("register_name", reg["name"])
                    .field("value", reg["value"])
                    .time(dt, WritePrecision.MS)
                )
                points.append(point)

            self.write_api.write(
                bucket=settings.influxdb_bucket,
                org=settings.influxdb_org,
                record=points,
            )
            logger.debug(f"Written {len(points)} points to InfluxDB")
            return True
        except Exception as e:
            logger.error(f"Error writing to InfluxDB: {e}")
            return False

    def get_latest_data(self, device_id: Optional[str] = None) -> List[Dict]:
        if not self.query_api:
            logger.warning("InfluxDB not connected, returning empty result")
            return []

        try:
            device_filter = f'|> filter(fn: (r) => r["device_id"] == "{device_id}")' if device_id else ""

            query = f"""
                from(bucket: "{settings.influxdb_bucket}")
                    |> range(start: -5m)
                    |> filter(fn: (r) => r["_measurement"] == "modbus_data")
                    {device_filter}
                    |> group(columns: ["register_name", "register_address", "device_id", "device_name"])
                    |> last()
                    |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            """

            result = self.query_api.query(query, org=settings.influxdb_org)
            data = []

            for table in result:
                for record in table.records:
                    data.append({
                        "time": record.get_time().isoformat(),
                        "device_id": record.values.get("device_id"),
                        "device_name": record.values.get("device_name"),
                        "register_address": int(record.values.get("register_address")),
                        "register_name": record.values.get("register_name"),
                        "value": record.values.get("value"),
                    })

            return data
        except Exception as e:
            logger.error(f"Error querying InfluxDB: {e}")
            return []

    def get_history_data(
        self,
        register_name: str,
        start_time: str = "-1h",
        device_id: Optional[str] = None,
    ) -> List[Dict]:
        if not self.query_api:
            logger.warning("InfluxDB not connected, returning empty result")
            return []

        try:
            device_filter = f'|> filter(fn: (r) => r["device_id"] == "{device_id}")' if device_id else ""

            query = f"""
                from(bucket: "{settings.influxdb_bucket}")
                    |> range(start: {start_time})
                    |> filter(fn: (r) => r["_measurement"] == "modbus_data")
                    |> filter(fn: (r) => r["register_name"] == "{register_name}")
                    {device_filter}
                    |> aggregateWindow(every: 10s, fn: mean, createEmpty: false)
                    |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            """

            result = self.query_api.query(query, org=settings.influxdb_org)
            data = []

            for table in result:
                for record in table.records:
                    data.append({
                        "time": record.get_time().isoformat(),
                        "register_name": record.values.get("register_name"),
                        "value": record.values.get("value"),
                    })

            return data
        except Exception as e:
            logger.error(f"Error querying history data: {e}")
            return []

    def get_device_list(self) -> List[Dict]:
        if not self.query_api:
            logger.warning("InfluxDB not connected, returning empty result")
            return []

        try:
            query = f"""
                from(bucket: "{settings.influxdb_bucket}")
                    |> range(start: -24h)
                    |> filter(fn: (r) => r["_measurement"] == "modbus_data")
                    |> keep(columns: ["device_id", "device_name"])
                    |> distinct(column: "device_id")
            """

            result = self.query_api.query(query, org=settings.influxdb_org)
            devices = {}

            for table in result:
                for record in table.records:
                    device_id = record.values.get("device_id")
                    if device_id and device_id not in devices:
                        devices[device_id] = {
                            "device_id": device_id,
                            "device_name": record.values.get("device_name", device_id),
                        }

            return list(devices.values())
        except Exception as e:
            logger.error(f"Error getting device list: {e}")
            return []

    def get_playback_data(
        self,
        start_time: str,
        stop_time: str,
        register_names: Optional[List[str]] = None,
        device_id: Optional[str] = None,
    ) -> Dict[str, List[Dict]]:
        if not self.query_api:
            logger.warning("InfluxDB not connected, returning empty result")
            return {}

        try:
            device_filter = f'|> filter(fn: (r) => r["device_id"] == "{device_id}")' if device_id else ""
            register_filter = ""
            if register_names:
                names_str = ", ".join(f'"{n}"' for n in register_names)
                register_filter = f'|> filter(fn: (r) => contains(r["register_name"], [{names_str}]))'

            query = f"""
                from(bucket: "{settings.influxdb_bucket}")
                    |> range(start: {start_time}, stop: {stop_time})
                    |> filter(fn: (r) => r["_measurement"] == "modbus_data")
                    {register_filter}
                    {device_filter}
                    |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
                    |> sort(columns: ["_time"])
            """

            result = self.query_api.query(query, org=settings.influxdb_org)
            grouped: Dict[str, List[Dict]] = {}

            for table in result:
                for record in table.records:
                    reg_name = record.values.get("register_name", "unknown")
                    if reg_name not in grouped:
                        grouped[reg_name] = []
                    grouped[reg_name].append({
                        "time": record.get_time().isoformat(),
                        "timestamp_ms": int(record.get_time().timestamp() * 1000),
                        "value": record.values.get("value"),
                    })

            return grouped
        except Exception as e:
            logger.error(f"Error querying playback data: {e}")
            return {}

    def close(self):
        if self.client:
            self.client.close()
            logger.info("InfluxDB connection closed")


influxdb_service = InfluxDBService()
