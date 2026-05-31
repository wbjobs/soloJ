from flask import Flask, request, jsonify
from flask_cors import CORS

from stock_data import get_stock_data
from bollinger_bands import calculate_bollinger_bands

app = Flask(__name__)
CORS(app)


@app.route('/api/stock', methods=['GET'])
def api_get_stock():
    symbol = request.args.get('symbol', 'AAPL')
    start_date = request.args.get('startDate')
    end_date = request.args.get('endDate')

    result = get_stock_data(symbol, start_date, end_date)
    return jsonify(result)


@app.route('/api/bollinger', methods=['POST'])
def api_calculate_bollinger():
    body = request.get_json()
    data = body.get('data', [])
    period = body.get('period', 20)
    std_dev = body.get('stdDev', 2.0)

    result = calculate_bollinger_bands(data, period, std_dev)
    return jsonify(result)


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
