import numpy as np
import pandas as pd
from datetime import datetime, timedelta


def generate_ohlcv_data(symbol: str, start_date: str, end_date: str,
                        initial_price: float = 100.0, volatility: float = 0.02) -> pd.DataFrame:
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    dates = pd.bdate_range(start=start, end=end)
    n_days = len(dates)

    np.random.seed(hash(symbol) % (2**32))

    returns = np.random.normal(loc=0.0005, scale=volatility, size=n_days)
    price_path = initial_price * np.exp(np.cumsum(returns))

    data = []
    for i, date in enumerate(dates):
        close = price_path[i]
        high_low_range = abs(returns[i]) * close * 2 + volatility * close * 0.5
        open_price = close * (1 + np.random.uniform(-volatility*0.3, volatility*0.3))
        high = max(open_price, close) + np.random.uniform(0, high_low_range)
        low = min(open_price, close) - np.random.uniform(0, high_low_range)
        volume = int(np.random.uniform(1_000_000, 10_000_000) * (1 + abs(returns[i]) * 5))

        data.append({
            "date": date.strftime("%Y-%m-%d"),
            "open": round(open_price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close, 2),
            "volume": volume
        })

    df = pd.DataFrame(data)
    return df


def get_stock_data(symbol: str, start_date: str = None, end_date: str = None) -> dict:
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    if start_date is None:
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    df = generate_ohlcv_data(symbol, start_date, end_date)

    return {
        "symbol": symbol,
        "startDate": start_date,
        "endDate": end_date,
        "data": df.to_dict(orient="records")
    }
