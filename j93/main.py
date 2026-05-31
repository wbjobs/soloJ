import signal
import sys
from tsdb import create_app


def main():
    app = create_app("./data")
    storage = app.config.get("tsdb_storage")
    retention = app.config.get("tsdb_retention")

    def graceful_shutdown(signum, frame):
        print("\nShutting down gracefully...")
        if retention:
            retention.close()
        if storage:
            storage.close()
        sys.exit(0)

    signal.signal(signal.SIGINT, graceful_shutdown)
    signal.signal(signal.SIGTERM, graceful_shutdown)

    print("Starting Lightweight TSDB Server...")
    print("API Endpoints:")
    print("  POST /api/v1/write - Write metrics")
    print("  GET/POST /api/v1/query - Execute query")
    print("  GET/POST /api/v1/query_range - Execute range query")
    print("  GET /api/v1/metrics - List all metrics")
    print("  GET /api/v1/series - List all series")
    print("  GET /api/v1/health - Health check")
    print("  POST /api/v1/retention - Create retention policy")
    print("  GET /api/v1/retention - List retention policies")
    print("  DELETE /api/v1/retention - Delete retention policy")
    print("  POST /api/v1/retention/enforce - Enforce policies now")
    app.run(host='0.0.0.0', port=8080, debug=False)


if __name__ == "__main__":
    main()
