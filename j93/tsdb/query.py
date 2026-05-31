import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from .storage import TimeSeriesStorage, TimeSeries, Sample


@dataclass
class QueryResult:
    metric: str
    labels: Dict[str, str]
    values: List[Tuple[int, float]]
    
    def to_dict(self) -> Dict:
        return {
            "metric": self.metric,
            "labels": self.labels,
            "values": [(ts, float(v)) for ts, v in self.values]
        }


class QueryEngineError(Exception):
    pass


class QueryEngine:
    def __init__(self, storage: TimeSeriesStorage):
        self.storage = storage
        self._functions = {
            "sum": self._agg_sum,
            "avg": self._agg_avg,
            "min": self._agg_min,
            "max": self._agg_max,
            "count": self._agg_count,
        }

    def parse(self, query: str) -> Dict:
        query = query.strip()
        
        rate_match = re.match(r'rate\(\s*(.*?)\[(\d+)([smh])\]\s*,\s*(\d+)([smh])\s*\)', query)
        if rate_match:
            inner = rate_match.group(1)
            range_val = int(rate_match.group(2))
            range_unit = rate_match.group(3)
            step_val = int(rate_match.group(4))
            step_unit = rate_match.group(5)
            return {
                "type": "rate",
                "inner": inner.strip(),
                "range": self._to_seconds(range_val, range_unit),
                "step": self._to_seconds(step_val, step_unit)
            }
        
        agg_match = re.match(r'(sum|avg|min|max|count)\(\s*(.*?)\s*\)\s+by\s+\(\s*(.*?)\s*\)', query)
        if agg_match:
            func = agg_match.group(1)
            inner = agg_match.group(2)
            by_labels = [l.strip() for l in agg_match.group(3).split(",")]
            return {
                "type": "aggregate",
                "function": func,
                "inner": inner.strip(),
                "by": by_labels
            }
        
        agg_match2 = re.match(r'(sum|avg|min|max|count)\(\s*(.*?)\s*\)', query)
        if agg_match2:
            func = agg_match2.group(1)
            inner = agg_match2.group(2)
            return {
                "type": "aggregate",
                "function": func,
                "inner": inner.strip(),
                "by": None
            }
        
        metric_match = re.match(r'(\w+)(\{(.*?)\})?', query)
        if metric_match:
            metric = metric_match.group(1)
            labels_str = metric_match.group(3)
            labels = {}
            if labels_str:
                for label_match in re.finditer(r'(\w+)\s*=\s*"([^"]*)"', labels_str):
                    labels[label_match.group(1)] = label_match.group(2)
            return {
                "type": "metric",
                "metric": metric,
                "labels": labels
            }
        
        raise QueryEngineError(f"Unsupported query: {query}")

    def _to_seconds(self, value: int, unit: str) -> int:
        if unit == 's':
            return value
        elif unit == 'm':
            return value * 60
        elif unit == 'h':
            return value * 3600
        return value

    def execute(self, query: str, start: Optional[int] = None, 
                end: Optional[int] = None) -> List[QueryResult]:
        parsed = self.parse(query)
        return self._execute_parsed(parsed, start, end)

    def _execute_parsed(self, parsed: Dict, start: Optional[int], 
                         end: Optional[int]) -> List[QueryResult]:
        if parsed["type"] == "metric":
            return self._execute_metric(parsed, start, end)
        elif parsed["type"] == "aggregate":
            return self._execute_aggregate(parsed, start, end)
        elif parsed["type"] == "rate":
            return self._execute_rate(parsed, start, end)
        else:
            raise QueryEngineError(f"Unknown query type: {parsed['type']}")

    def _execute_metric(self, parsed: Dict, start: Optional[int], 
                           end: Optional[int]) -> List[QueryResult]:
        series_list = self.storage.query_range(
            parsed["metric"], 
            parsed["labels"],
            start, end
        )
        return [
            QueryResult(
                metric=s.metric,
                labels=s.labels,
                values=[(sample.timestamp, sample.value) for sample in s.samples]
            )
            for s in series_list
        ]

    def _execute_aggregate(self, parsed: Dict, start: Optional[int], 
                               end: Optional[int]) -> List[QueryResult]:
        inner_parsed = self.parse(parsed["inner"])
        inner_results = self._execute_parsed(inner_parsed, start, end)
        
        func = parsed["function"]
        by_labels = parsed["by"]
        
        if func not in self._functions:
            raise QueryEngineError(f"Unknown aggregate function: {func}")
        
        agg_func = self._functions[func]
        
        if by_labels is None:
            all_values = []
            for result in inner_results:
                all_values.extend(result.values)
            
            if all_values:
                agg_value = agg_func(all_values)
                return [QueryResult(
                    metric=f"{func}({parsed['inner']})",
                    labels={},
                    values=[(end if end else all_values[-1][0], agg_value)]
                )]
            return []
        
        groups = {}
        for result in inner_results:
            group_key = tuple(
                result.labels.get(label, "") for label in by_labels
            )
            if group_key not in groups:
                groups[group_key] = {
                    "labels": {label: result.labels.get(label, "") 
                               for label in by_labels},
                    "values": []
                }
            groups[group_key]["values"].extend(result.values)
        
        agg_results = []
        for group_key, group_data in groups.items():
            if group_data["values"]:
                agg_value = agg_func(group_data["values"])
                agg_results.append(QueryResult(
                    metric=f"{func}({parsed['inner']})",
                    labels=group_data["labels"],
                    values=[(end if end else group_data["values"][-1][0], agg_value)]
                ))
        
        return agg_results

    def _execute_rate(self, parsed: Dict, start: Optional[int], 
                        end: Optional[int]) -> List[QueryResult]:
        inner_parsed = self.parse(parsed["inner"])
        range_sec = parsed["range"]
        step_sec = parsed["step"]
        
        if start is None or end is None:
            raise QueryEngineError("rate() requires start and end timestamps")
        
        inner_results = self._execute_parsed(inner_parsed, start, end)
        
        rate_results = []
        for result in inner_results:
            rate_values = self._calculate_rate(
                result.values, range_sec, step_sec, start, end
            )
            rate_results.append(QueryResult(
                metric=f"rate({result.metric})",
                labels=result.labels,
                values=rate_values
            ))
        
        return rate_results

    def _calculate_rate(self, values: List[Tuple[int, float]], 
                      range_sec: int, step_sec: int,
                      start: int, end: int) -> List[Tuple[int, float]]:
        if not values:
            return []
        
        sorted_values = sorted(values, key=lambda x: x[0])
        
        rate_points = []
        current = start
        
        while current <= end:
            window_start = current - range_sec
            
            window_values = [
                (ts, v) for ts, v in sorted_values 
                if window_start <= ts <= current
            ]
            
            if len(window_values) >= 2:
                first_ts, first_val = window_values[0]
                last_ts, last_val = window_values[-1]
                
                if last_ts > first_ts:
                    rate = (last_val - first_val) / (last_ts - first_ts)
                    rate_points.append((current, rate))
            
            current += step_sec
        
        return rate_points

    def _agg_sum(self, values: List[Tuple[int, float]]) -> float:
        return sum(v for _, v in values)

    def _agg_avg(self, values: List[Tuple[int, float]]) -> float:
        if not values:
            return 0.0
        return sum(v for _, v in values) / len(values)

    def _agg_min(self, values: List[Tuple[int, float]]) -> float:
        if not values:
            return 0.0
        return min(v for _, v in values)

    def _agg_max(self, values: List[Tuple[int, float]]) -> float:
        if not values:
            return 0.0
        return max(v for _, v in values)

    def _agg_count(self, values: List[Tuple[int, float]]) -> float:
        return float(len(values))
