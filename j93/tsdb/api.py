from flask import Flask, request, jsonify
from typing import Optional
from .storage import TimeSeriesStorage
from .query import QueryEngine, QueryEngineError
from .retention import RetentionManager, RetentionPolicy, DownsamplePolicy


def create_app(data_dir: Optional[str] = None):
    app = Flask(__name__)

    if data_dir:
        storage = TimeSeriesStorage(data_dir)
    else:
        storage = TimeSeriesStorage()

    query_engine = QueryEngine(storage)
    retention_manager = RetentionManager(storage, check_interval=60.0)

    app.config["tsdb_storage"] = storage
    app.config["tsdb_retention"] = retention_manager

    @app.route('/api/v1/write', methods=['POST'])
    def write_data():
        try:
            data = request.get_json()
            if isinstance(data, dict):
                points = [data]
            else:
                points = data

            written = 0
            for point in points:
                metric = point.get('metric')
                labels = point.get('labels', {})
                timestamp = point.get('timestamp')
                value = point.get('value')

                if not metric or timestamp is None or value is None:
                    return jsonify({
                        "error": "Missing required fields: metric, timestamp, value"
                    }), 400

                storage.write(metric, labels, timestamp, value)
                written += 1

            return jsonify({
                "status": "success",
                "written": written
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/query', methods=['GET', 'POST'])
    def query():
        try:
            if request.method == 'GET':
                query_str = request.args.get('query')
                start = request.args.get('start')
                end = request.args.get('end')
            else:
                data = request.get_json()
                query_str = data.get('query')
                start = data.get('start')
                end = data.get('end')

            if not query_str:
                return jsonify({"error": "Missing query parameter"}), 400

            start_ts = int(start) if start else None
            end_ts = int(end) if end else None

            results = query_engine.execute(query_str, start_ts, end_ts)

            return jsonify({
                "status": "success",
                "data": [r.to_dict() for r in results]
            }), 200
        except QueryEngineError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/query_range', methods=['GET', 'POST'])
    def query_range():
        try:
            if request.method == 'GET':
                query_str = request.args.get('query')
                start = request.args.get('start')
                end = request.args.get('end')
            else:
                data = request.get_json()
                query_str = data.get('query')
                start = data.get('start')
                end = data.get('end')

            if not query_str or not start or not end:
                return jsonify({"error": "Missing required parameters: query, start, end"}), 400

            start_ts = int(start)
            end_ts = int(end)

            results = query_engine.execute(query_str, start_ts, end_ts)

            return jsonify({
                "status": "success",
                "data": [r.to_dict() for r in results]
            }), 200
        except QueryEngineError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/metrics', methods=['GET'])
    def list_metrics():
        try:
            metrics = storage.get_all_metrics()
            return jsonify({
                "status": "success",
                "data": metrics
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/series', methods=['GET'])
    def list_series():
        try:
            metric = request.args.get('metric')
            series = storage.find_series(metric)
            return jsonify({
                "status": "success",
                "data": series
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/health', methods=['GET'])
    def health():
        return jsonify({
            "status": "healthy",
            "version": "0.1.0"
        }), 200

    @app.route('/api/v1/retention', methods=['POST'])
    def create_retention_policy():
        try:
            data = request.get_json()
            if not data or 'metric' not in data or 'retention_seconds' not in data:
                return jsonify({
                    "error": "Missing required fields: metric, retention_seconds"
                }), 400

            metric = data['metric']
            retention_seconds = int(data['retention_seconds'])

            downsample_policies = []
            for ds in data.get('downsample', []):
                if 'after_seconds' not in ds or 'granularity_seconds' not in ds:
                    return jsonify({
                        "error": "Each downsample rule requires after_seconds and granularity_seconds"
                    }), 400
                downsample_policies.append(DownsamplePolicy(
                    after_seconds=int(ds['after_seconds']),
                    granularity_seconds=int(ds['granularity_seconds']),
                    aggregation=ds.get('aggregation', 'avg'),
                ))

            downsample_policies.sort(key=lambda d: d.after_seconds)

            policy = RetentionPolicy(
                metric=metric,
                retention_seconds=retention_seconds,
                downsample=downsample_policies,
            )

            retention_manager.add_policy(policy)

            return jsonify({
                "status": "success",
                "data": policy.to_dict()
            }), 200
        except (ValueError, KeyError) as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/retention', methods=['GET'])
    def list_retention_policies():
        try:
            metric = request.args.get('metric')
            policies = retention_manager.list_policies()
            if metric:
                policies = [p for p in policies if p.metric == metric]
            return jsonify({
                "status": "success",
                "data": [p.to_dict() for p in policies]
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/retention', methods=['DELETE'])
    def delete_retention_policy():
        try:
            metric = request.args.get('metric') or (request.get_json() or {}).get('metric')
            if not metric:
                return jsonify({"error": "Missing metric parameter"}), 400

            removed = retention_manager.remove_policy(metric)
            if not removed:
                return jsonify({"error": f"No retention policy found for metric: {metric}"}), 404

            return jsonify({
                "status": "success",
                "metric": metric
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/api/v1/retention/enforce', methods=['POST'])
    def enforce_retention():
        try:
            retention_manager.enforce_all_policies()
            return jsonify({
                "status": "success",
                "message": "Retention policies enforced"
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return app
