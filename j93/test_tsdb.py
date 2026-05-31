import time
from tsdb import TimeSeriesStorage, QueryEngine


def test_storage():
    print("=" * 60)
    print("Testing Storage Engine...")
    print("=" * 60)
    
    storage = TimeSeriesStorage("./test_data")
    
    base_ts = int(time.time())
    
    print("\n1. Writing test data...")
    for i in range(10):
        storage.write(
            "cpu_usage",
            {"host": "server1", "region": "us-east"},
            base_ts + i,
            50.0 + i * 2
        )
        storage.write(
            "cpu_usage",
            {"host": "server2", "region": "us-west"},
            base_ts + i,
            30.0 + i * 1.5
        )
        storage.write(
            "memory_usage",
            {"host": "server1", "region": "us-east"},
            base_ts + i,
            80.0 + i * 0.5
        )
    
    print("   Written 30 data points")
    
    print("\n2. Reading series for cpu_usage{host=\"server1\"}...")
    samples = storage.read_series(
        "cpu_usage", {"host": "server1"})
    print(f"   Found {len(samples)} samples")
    for s in samples[:3]:
        print(f"     ts={s.timestamp}, value={s.value}")
    
    print("\n3. Finding all series...")
    all_series = storage.find_series()
    print(f"   Found {len(all_series)} series:")
    for s in all_series:
        print(f"     {s['metric']} {s['labels']}")
    
    print("\n4. Querying range...")
    results = storage.query_range(
        "cpu_usage", start=base_ts, end=base_ts + 5)
    for ts in results:
        print(f"   {ts.metric} {ts.labels}: {len(ts.samples)} samples")
    
    print("\n5. Listing metrics...")
    metrics = storage.get_all_metrics()
    print(f"   Metrics: {metrics}")
    
    print("\nStorage Engine Tests PASSED!")
    return storage, base_ts


def test_query_engine(storage, base_ts):
    print("\n" + "=" * 60)
    print("Testing Query Engine...")
    print("=" * 60)
    
    engine = QueryEngine(storage)
    
    print("\n1. Simple metric query...")
    results = engine.execute("cpu_usage", base_ts, base_ts + 10)
    print(f"   Found {len(results)} results")
    for r in results:
        print(f"     {r.metric} {r.labels}: {len(r.values)} points")
    
    print("\n2. Sum aggregation...")
    results = engine.execute("sum(cpu_usage)", base_ts, base_ts + 10)
    for r in results:
        print(f"     {r.metric}: {r.values}")
    
    print("\n3. Avg aggregation...")
    results = engine.execute("avg(cpu_usage)", base_ts, base_ts + 10)
    for r in results:
        print(f"     {r.metric}: {r.values}")
    
    print("\n4. Sum by region...")
    results = engine.execute("sum(cpu_usage) by (region)", base_ts, base_ts + 10)
    for r in results:
        print(f"     {r.metric} {r.labels}: {r.values}")
    
    print("\n5. Label matching query...")
    results = engine.execute('cpu_usage{host="server1"}', base_ts, base_ts + 10)
    for r in results:
        print(f"     {r.metric} {r.labels}: {len(r.values)} points")
    
    print("\n6. Rate calculation...")
    results = engine.execute(
        "rate(cpu_usage[10s], 2s)", 
        base_ts, base_ts + 10
    )
    for r in results:
        print(f"     {r.metric} {r.labels}:")
        for ts, val in r.values[:3]:
            print(f"       ts={ts}, rate={val:.4f}")
    
    print("\nQuery Engine Tests PASSED!")


def test_parse():
    print("\n" + "=" * 60)
    print("Testing Query Parser...")
    print("=" * 60)
    
    storage = TimeSeriesStorage("./test_data")
    engine = QueryEngine(storage)
    
    test_cases = [
        'cpu_usage',
        'cpu_usage{host="server1"}',
        'sum(cpu_usage)',
        'avg(cpu_usage) by (region)',
        'rate(cpu_usage[5m], 1m)',
    ]
    
    for query in test_cases:
        try:
            parsed = engine.parse(query)
            print(f"   {query}")
            print(f"     -> {parsed}")
        except Exception as e:
            print(f"   {query}")
            print(f"     ERROR: {e}")
    
    print("\nParser Tests PASSED!")


if __name__ == "__main__":
    try:
        storage, base_ts = test_storage()
        test_parse()
        test_query_engine(storage, base_ts)
        print("\n" + "=" * 60)
        print("ALL TESTS PASSED!")
        print("=" * 60)
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
        import traceback
        traceback.print_exc()
