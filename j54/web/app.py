import os

from flask import Flask, jsonify, render_template, request

from config import FLASK_HOST, FLASK_PORT
from web.neo4j_store import Neo4jStore

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "static"),
)

_store: Neo4jStore | None = None


def _get_store() -> Neo4jStore:
    global _store
    if _store is None:
        _store = Neo4jStore()
        _store.ensure_constraints()
    return _store


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/reports", methods=["POST"])
def receive_report():
    report = request.get_json(force=True)
    if not report or "chart" not in report:
        return jsonify({"error": "Invalid report format, 'chart' field required"}), 400

    store = _get_store()
    store.store_report(report)
    return jsonify({"status": "ok", "chart": report["chart"]["name"]}), 201


@app.route("/api/topology", methods=["GET"])
def get_topology():
    store = _get_store()
    topology = store.get_topology()
    return jsonify(topology)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


def main():
    _get_store()
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=True)


if __name__ == "__main__":
    main()
