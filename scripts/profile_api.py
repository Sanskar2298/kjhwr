"""Deep investigation script to profile FUELHH and WINDFOR data characteristics.

Analyzes 3 sample days (2026-01-01 to 2026-01-03):
- Exact schema, field names, data types
- Timezone representation (UTC / Z)
- Forecasts count per target startTime
- Horizon range (lead time between publishTime and startTime)
- Publishing frequency
- Server-side filtering behavior (fuelType=WIND)
- Duplicate detection, missing settlement periods, null checks
"""

import json
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
import dateutil.parser

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"

def fetch_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def analyze_fuelhh():
    print("=" * 60)
    print("ANALYZING FUELHH (2026-01-01 to 2026-01-03)")
    print("=" * 60)
    # 1. Test server-side fuelType filter
    url_wind = f"{BASE_URL}/datasets/FUELHH/stream?settlementDateFrom=2026-01-01&settlementDateTo=2026-01-03&fuelType=WIND"
    data_wind = fetch_json(url_wind)
    print(f"Total WIND records: {len(data_wind)}")
    
    url_all = f"{BASE_URL}/datasets/FUELHH/stream?settlementDateFrom=2026-01-01&settlementDateTo=2026-01-01"
    data_all = fetch_json(url_all)
    fuels = Counter(r.get("fuelType") for r in data_all)
    print("Server-side fuelType filter test: All fuels returned without param:", list(fuels.keys())[:5])
    print(f"Confirmed server-side filtering: {all(r.get('fuelType') == 'WIND' for r in data_wind)}")

    # Field analysis
    sample = data_wind[0]
    print("\nSample FUELHH Record:")
    print(json.dumps(sample, indent=2))
    print("Fields and Python Types:")
    for k, v in sample.items():
        print(f"  - {k}: {type(v).__name__} (value: {repr(v)})")

    # Timezone check
    for field in ["startTime", "publishTime"]:
        val = sample.get(field)
        dt = dateutil.parser.isoparse(val)
        print(f"  Timezone of {field}: tzinfo={dt.tzinfo}, ends with Z={val.endswith('Z')}")

    # Settlement period coverage
    sp_by_date = defaultdict(set)
    duplicates = 0
    seen = set()
    nulls = defaultdict(int)

    for r in data_wind:
        key = (r["settlementDate"], r["settlementPeriod"], r["startTime"])
        if key in seen:
            duplicates += 1
        seen.add(key)
        sp_by_date[r["settlementDate"]].add(r["settlementPeriod"])
        for k, v in r.items():
            if v is None:
                nulls[k] += 1

    print("\nSettlement periods per date:")
    for dt_str, sp_set in sorted(sp_by_date.items()):
        print(f"  {dt_str}: {len(sp_set)} periods (expected 48, missing: {set(range(1, 49)) - sp_set})")
    print(f"Duplicates detected: {duplicates}")
    print(f"Null values: {dict(nulls)}")

def analyze_windfor():
    print("\n" + "=" * 60)
    print("ANALYZING WINDFOR (2026-01-01 to 2026-01-03)")
    print("=" * 60)
    # Pull 3 days of published forecasts
    url = f"{BASE_URL}/datasets/WINDFOR/stream?publishDateTimeFrom=2026-01-01T00:00:00Z&publishDateTimeTo=2026-01-04T00:00:00Z"
    data = fetch_json(url)
    print(f"Total WINDFOR records fetched: {len(data)}")

    sample = data[0]
    print("\nSample WINDFOR Record:")
    print(json.dumps(sample, indent=2))
    print("Fields and Python Types:")
    for k, v in sample.items():
        print(f"  - {k}: {type(v).__name__} (value: {repr(v)})")

    # Timezone check
    for field in ["startTime", "publishTime"]:
        val = sample.get(field)
        dt = dateutil.parser.isoparse(val)
        print(f"  Timezone of {field}: tzinfo={dt.tzinfo}, ends with Z={val.endswith('Z')}")

    # Publishing cadences
    publish_times = sorted(set(r["publishTime"] for r in data))
    print(f"\nUnique publish times: {len(publish_times)}")
    print(f"Sample consecutive publish times: {publish_times[:6]}")
    # Calculate publish intervals
    pub_intervals = []
    for i in range(1, min(len(publish_times), 30)):
        dt1 = dateutil.parser.isoparse(publish_times[i-1])
        dt2 = dateutil.parser.isoparse(publish_times[i])
        pub_intervals.append((dt2 - dt1).total_seconds() / 60)
    print(f"Publish interval distribution (minutes): {Counter(pub_intervals)}")

    # Horizon analysis
    horizons = []
    target_starts = defaultdict(list)
    nulls = defaultdict(int)
    duplicates = 0
    seen = set()

    for r in data:
        key = (r["publishTime"], r["startTime"])
        if key in seen:
            duplicates += 1
        seen.add(key)
        for k, v in r.items():
            if v is None:
                nulls[k] += 1
        
        t_pub = dateutil.parser.isoparse(r["publishTime"])
        t_start = dateutil.parser.isoparse(r["startTime"])
        lead_hours = (t_start - t_pub).total_seconds() / 3600.0
        horizons.append(lead_hours)
        target_starts[r["startTime"]].append(r)

    print(f"\nForecast lead time horizon (hours):")
    print(f"  Min horizon: {min(horizons):.1f}h")
    print(f"  Max horizon: {max(horizons):.1f}h")
    print(f"  Negative horizons (retrospective outturns/backcasts): {sum(1 for h in horizons if h < 0)}")
    print(f"  0h to 24h: {sum(1 for h in horizons if 0 <= h < 24)}")
    print(f"  24h to 48h (Day-Ahead window): {sum(1 for h in horizons if 24 <= h < 48)}")
    print(f"  48h+: {sum(1 for h in horizons if h >= 48)}")

    # How many forecasts per target startTime?
    counts_per_start = [len(v) for v in target_starts.values()]
    print(f"\nForecasts per target startTime:")
    print(f"  Total unique target startTimes: {len(target_starts)}")
    print(f"  Min forecasts per startTime: {min(counts_per_start)}")
    print(f"  Max forecasts per startTime: {max(counts_per_start)}")
    print(f"  Average forecasts per startTime: {sum(counts_per_start) / len(counts_per_start):.1f}")

    # Inspect cadence of target startTimes (30 min vs 60 min)
    sample_target_starts = sorted(target_starts.keys())[:10]
    print(f"Sample target startTimes: {sample_target_starts}")
    
    print(f"\nDuplicates detected: {duplicates}")
    print(f"Null values: {dict(nulls)}")

if __name__ == "__main__":
    analyze_fuelhh()
    analyze_windfor()
