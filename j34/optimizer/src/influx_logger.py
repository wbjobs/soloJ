import os
from datetime import datetime
from typing import Dict, Optional, List


class InfluxDBLogger:
    def __init__(
        self,
        url: str = None,
        token: str = None,
        org: str = None,
        bucket: str = None
    ):
        self.url = url or os.environ.get('INFLUXDB_URL', 'http://localhost:8086')
        self.token = token or os.environ.get('INFLUXDB_TOKEN', 'my-secret-token')
        self.org = org or os.environ.get('INFLUXDB_ORG', 'acoustic_metamaterial')
        self.bucket = bucket or os.environ.get('INFLUXDB_BUCKET', 'optimization_logs')
        self._client = None
        self._write_api = None

    def _get_client(self):
        if self._client is None:
            try:
                from influxdb_client import InfluxDBClient
                self._client = InfluxDBClient(
                    url=self.url,
                    token=self.token,
                    org=self.org
                )
                self._write_api = self._client.write_api()
            except ImportError:
                raise ImportError("influxdb-client package is required")
        return self._client, self._write_api

    def log_iteration(
        self,
        job_id: str,
        iteration: int,
        objective_score: float,
        params: Dict[str, float],
        band_gaps: Optional[List[Dict]] = None,
        extra_fields: Optional[Dict] = None
    ):
        try:
            client, write_api = self._get_client()

            from influxdb_client import Point, WritePrecision

            point = Point("optimization_iteration") \
                .tag("job_id", job_id) \
                .field("iteration", int(iteration)) \
                .field("objective_score", float(objective_score)) \
                .time(datetime.utcnow(), WritePrecision.MS)

            for param_name, param_value in params.items():
                point.field(f"param_{param_name}", float(param_value))

            if band_gaps:
                point.field("num_band_gaps", len(band_gaps))
                for i, gap in enumerate(band_gaps):
                    point.field(f"gap_{i}_start", float(gap.get('start', 0)))
                    point.field(f"gap_{i}_end", float(gap.get('end', 0)))
                    point.field(f"gap_{i}_width", float(gap.get('width', 0)))

            if extra_fields:
                for k, v in extra_fields.items():
                    if isinstance(v, (int, float)):
                        point.field(k, v)

            write_api.write(bucket=self.bucket, org=self.org, record=point)

        except Exception as e:
            print(f"InfluxDB log error: {e}")

    def log_optimization_start(self, job_id: str, config: Dict):
        try:
            client, write_api = self._get_client()

            from influxdb_client import Point, WritePrecision

            point = Point("optimization_event") \
                .tag("job_id", job_id) \
                .tag("event_type", "start") \
                .field("budget", int(config.get('budget', 0))) \
                .field("target_start", float(config.get('target_band_gap_start', 0))) \
                .field("target_end", float(config.get('target_band_gap_end', 0))) \
                .time(datetime.utcnow(), WritePrecision.MS)

            write_api.write(bucket=self.bucket, org=self.org, record=point)

        except Exception as e:
            print(f"InfluxDB log error: {e}")

    def log_optimization_complete(self, job_id: str, best_score: float, best_params: Dict):
        try:
            client, write_api = self._get_client()

            from influxdb_client import Point, WritePrecision

            point = Point("optimization_event") \
                .tag("job_id", job_id) \
                .tag("event_type", "complete") \
                .field("best_score", float(best_score)) \
                .time(datetime.utcnow(), WritePrecision.MS)

            for k, v in best_params.items():
                point.field(f"best_{k}", float(v))

            write_api.write(bucket=self.bucket, org=self.org, record=point)

        except Exception as e:
            print(f"InfluxDB log error: {e}")

    def query_optimization_history(self, job_id: str) -> List[Dict]:
        try:
            client, _ = self._get_client()
            query_api = client.query_api()

            query = f'''
            from(bucket: "{self.bucket}")
              |> range(start: -30d)
              |> filter(fn: (r) => r["_measurement"] == "optimization_iteration")
              |> filter(fn: (r) => r["job_id"] == "{job_id}")
              |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
              |> sort(columns: ["iteration"])
            '''

            result = query_api.query(query, org=self.org)
            records = []
            for table in result:
                for record in table.records:
                    records.append(record.values)
            return records

        except Exception as e:
            print(f"InfluxDB query error: {e}")
            return []

    def close(self):
        if self._client:
            self._client.close()
            self._client = None
            self._write_api = None
