import pandas as pd
import numpy as np


def calculate_bollinger_bands(data: list, period: int = 20, std_dev: float = 2.0) -> dict:
    df = pd.DataFrame(data)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')

    df['middle'] = df['close'].rolling(window=period).mean()
    df['std'] = df['close'].rolling(window=period).std()
    df['upper'] = df['middle'] + (std_dev * df['std'])
    df['lower'] = df['middle'] - (std_dev * df['std'])

    df = df.round(2)

    bands = []
    for _, row in df.iterrows():
        bands.append({
            "date": row['date'].strftime("%Y-%m-%d"),
            "upper": None if pd.isna(row['upper']) else row['upper'],
            "middle": None if pd.isna(row['middle']) else row['middle'],
            "lower": None if pd.isna(row['lower']) else row['lower']
        })

    return {
        "bands": bands,
        "period": period,
        "stdDev": std_dev
    }
