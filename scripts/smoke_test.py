#!/usr/bin/env python3
"""Post-Deployment Smoke Test Script for Vercel.

Usage:
    python scripts/smoke_test.py https://your-deployment-url.vercel.app

Tests:
    1. Static frontend loads with 200 OK
    2. /api/health responds with status: healthy
    3. /api/meta returns date bounds for January 2026
    4. /api/forecast/decision returns 48 points for day-ahead market
    5. /api/accuracy/summary computes valid MAE/RMSE metrics
"""

import sys
import json
import urllib.request
import urllib.error

def run_smoke_test(base_url: str):
    base_url = base_url.rstrip("/")
    print(f"\n[+] Running Post-Deployment Smoke Test on: {base_url}\n")
    
    tests = [
        ("1. Frontend HTML Landing Page", f"{base_url}/", lambda data, code: code == 200 and b"Wind Forecast Monitor" in data),
        ("2. Health Check API", f"{base_url}/api/health", lambda data, code: code == 200 and json.loads(data).get("status") == "healthy"),
        ("3. System Metadata API", f"{base_url}/api/meta", lambda data, code: code == 200 and "min_delivery_date" in json.loads(data)),
        ("4. Day-Ahead Decision Forecast", f"{base_url}/api/forecast/decision?delivery_date=2026-01-15&cutoff_hour=09:00", lambda data, code: code == 200 and len(json.loads(data).get("points", [])) == 48),
        ("5. Accuracy Summary KPIs", f"{base_url}/api/accuracy/summary?start=2026-01-01&end=2026-01-31&cutoff_hour=09:00", lambda data, code: code == 200 and json.loads(data).get("mae_mw", 0) > 0),
    ]

    all_passed = True

    for name, url, validator in tests:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "AEROCAST-SmokeTest/1.0", "Accept": "*/*"}
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                content = resp.read()
                code = resp.status
                if validator(content, code):
                    print(f"  [PASS] {name} (HTTP {code})")
                else:
                    print(f"  [FAIL] {name} - Validation check failed. Response preview: {content[:200]}")
                    all_passed = False
        except urllib.error.HTTPError as e:
            print(f"  [FAIL] {name} - HTTP Error {e.code}: {e.reason}")
            all_passed = False
        except Exception as e:
            print(f"  [FAIL] {name} - Connection failure: {str(e)}")
            all_passed = False

    print("\n" + ("=" * 60))
    if all_passed:
        print(" [SUCCESS] All Vercel endpoints verified successfully!")
        sys.exit(0)
    else:
        print(" [ERROR] One or more smoke tests failed.")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Error: Target deployment URL required.")
        print("Usage: python scripts/smoke_test.py https://<app-name>.vercel.app")
        sys.exit(1)
    run_smoke_test(sys.argv[1])
