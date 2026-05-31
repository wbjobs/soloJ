import numpy as np
from typing import List, Dict, Optional
from datetime import datetime

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS, ASYNCHRONOUS

from app.config import INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET


class InfluxDBManager:
    def __init__(self):
        self.client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        self.write_api = self.client.write_api(write_options=ASYNCHRONOUS)
        self.query_api = self.client.query_api()
        self.org = INFLUXDB_ORG
        self.bucket = INFLUXDB_BUCKET

    async def write_signal(
        self,
        sensor_id: str,
        data: np.ndarray,
        timestamp: datetime,
        channel_names: Optional[List[str]] = None,
        sampling_rate: int = 50000,
    ):
        num_channels = data.shape[1] if data.ndim == 2 else 1
        if channel_names is None:
            channel_names = [f"ch_{i}" for i in range(num_channels)]

        points = []
        if data.ndim == 1:
            data = data.reshape(-1, 1)

        for sample_idx in range(data.shape[0]):
            t = timestamp.timestamp() + sample_idx / sampling_rate
            for ch_idx in range(num_channels):
                point = (
                    Point("vibration_signal")
                    .tag("sensor_id", sensor_id)
                    .tag("channel", channel_names[ch_idx])
                    .field("value", float(data[sample_idx, ch_idx]))
                    .time(int(t * 1e9), WritePrecision.NS)
                )
                points.append(point)

        self.write_api.write(bucket=self.bucket, org=self.org, record=points)

    def query_signal(
        self,
        sensor_id: str,
        start_time: datetime,
        end_time: datetime,
        channels: Optional[List[str]] = None,
    ) -> Dict:
        channel_filter = ""
        if channels:
            ch_list = " or ".join([f'r["channel"] == "{ch}"' for ch in channels])
            channel_filter = f'|> filter(fn: ({ch_list}))'

        query = f'''
        from(bucket: "{self.bucket}")
          |> range(start: {start_time.isoformat()}, stop: {end_time.isoformat()})
          |> filter(fn: (r) => r["_measurement"] == "vibration_signal")
          |> filter(fn: (r) => r["sensor_id"] == "{sensor_id}")
          {channel_filter}
          |> pivot(rowKey: ["_time"], columnKey: ["channel"], valueColumn: "_value")
        '''

        result = self.query_api.query_data_frame(query, org=self.org)
        return result

    def query_signal_raw(
        self,
        sensor_id: str,
        start_time: datetime,
        end_time: datetime,
        channel: str = "ch_0",
    ) -> Dict:
        query = f'''
        from(bucket: "{self.bucket}")
          |> range(start: {start_time.isoformat()}, stop: {end_time.isoformat()})
          |> filter(fn: (r) => r["_measurement"] == "vibration_signal")
          |> filter(fn: (r) => r["sensor_id"] == "{sensor_id}")
          |> filter(fn: (r) => r["channel"] == "{channel}")
        '''
        result = self.query_api.query_data_frame(query, org=self.org)
        return result

    def close(self):
        self.write_api.close()
        self.client.close()


influx_manager = InfluxDBManager()
