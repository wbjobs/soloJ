import os

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_TOPIC_VIBRATION = "vibration-raw"

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-super-secret-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "vibration")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "raw_signals")

POSTGRES_DSN = os.getenv(
    "POSTGRES_DSN",
    "postgresql+asyncpg://vibration:vibration@localhost:5432/vibration_diag",
)

SAMPLING_RATE = 50000
NUM_CHANNELS = 24
WINDOW_SIZE_SECONDS = 2.0
WINDOW_HOP_SECONDS = 0.5
WINDOW_SIZE = int(SAMPLING_RATE * WINDOW_SIZE_SECONDS)
WINDOW_HOP = int(SAMPLING_RATE * WINDOW_HOP_SECONDS)

FEATURE_NAMES = [
    "sample_entropy",
    "fuzzy_entropy",
    "permutation_entropy",
    "rms",
    "kurtosis",
    "skewness",
    "crest_factor",
    "shape_factor",
    "impulse_factor",
    "margin_factor",
]

FAULT_TYPES = ["bearing_inner", "bearing_outer", "bearing_ball", "gear_wear", "misalignment", "normal"]
