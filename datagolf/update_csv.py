#!/usr/bin/env python3
"""
Data Golf -> CSV extract step.

Fetches data from the Data Golf API (https://feeds.datagolf.com) and writes
normalized CSV snapshots to datagolf/data/. Each run overwrites the previous
snapshot atomically, so a failed run never corrupts an existing CSV.

Requires the DATAGOLF_KEY environment variable (Scratch Plus membership key).

Usage:
    python datagolf/update_csv.py                     # all datasets
    python datagolf/update_csv.py --datasets rankings,players
    python datagolf/update_csv.py --tour pga --out-dir datagolf/data
"""

import argparse
import os
import sys
import tempfile
import time
from datetime import datetime, timezone

import pandas as pd
import requests

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

BASE_URL = os.environ.get("DATAGOLF_BASE_URL", "https://feeds.datagolf.com")

# Stay well under Data Golf's 45 requests/minute limit.
SECONDS_BETWEEN_REQUESTS = 1.5
MAX_RETRIES = 3
RETRY_STATUSES = {429, 500, 502, 503, 504}


class DatasetError(Exception):
    pass


def _fetch(path: str, params: dict) -> object:
    """GET a Data Golf endpoint with retries and return parsed JSON."""
    url = f"{BASE_URL}{path}"
    params = {**params, "key": os.environ["DATAGOLF_KEY"], "file_format": "json"}
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, params=params, timeout=30)
            if resp.status_code in RETRY_STATUSES:
                raise DatasetError(f"HTTP {resp.status_code}")
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, DatasetError, ValueError) as err:
            last_error = err
            if attempt < MAX_RETRIES:
                time.sleep(2**attempt)
    raise DatasetError(f"GET {path} failed after {MAX_RETRIES} attempts: {last_error}")


# ---------------------------------------------------------------------------
# Dataset definitions: each returns a DataFrame with a stable column set.
# ---------------------------------------------------------------------------


def fetch_players(tour: str) -> pd.DataFrame:
    data = _fetch("/get-player-list", {})
    return pd.DataFrame(data)


def fetch_rankings(tour: str) -> pd.DataFrame:
    data = _fetch("/preds/get-dg-rankings", {})
    return pd.DataFrame(data["rankings"])


def fetch_schedule(tour: str) -> pd.DataFrame:
    data = _fetch("/get-schedule", {"tour": tour})
    return pd.DataFrame(data["schedule"])


def fetch_field(tour: str) -> pd.DataFrame:
    data = _fetch("/field-updates", {"tour": tour})
    df = pd.DataFrame(data["field"])
    df.insert(0, "event_name", data.get("event_name"))
    return df


def fetch_predictions(tour: str) -> pd.DataFrame:
    data = _fetch("/preds/pre-tournament", {"tour": tour, "odds_format": "percent"})
    df = pd.DataFrame(data["baseline"])
    df.insert(0, "event_name", data.get("event_name"))
    return df


def fetch_skill_ratings(tour: str) -> pd.DataFrame:
    data = _fetch("/preds/skill-ratings", {"display": "value"})
    return pd.DataFrame(data["players"])


DATASETS = {
    "players": (fetch_players, "dg_players.csv", ["dg_id", "player_name"]),
    "rankings": (fetch_rankings, "dg_rankings.csv", ["dg_id", "player_name", "datagolf_rank"]),
    "schedule": (fetch_schedule, "dg_schedule.csv", ["event_id", "event_name"]),
    "field": (fetch_field, "dg_field.csv", ["dg_id", "player_name"]),
    "predictions": (fetch_predictions, "dg_predictions.csv", ["dg_id", "player_name", "win"]),
    "skill_ratings": (fetch_skill_ratings, "dg_skill_ratings.csv", ["dg_id", "player_name", "sg_total"]),
}


def validate(df: pd.DataFrame, required_columns: list) -> None:
    if df.empty:
        raise DatasetError("response produced an empty table")
    missing = [c for c in required_columns if c not in df.columns]
    if missing:
        raise DatasetError(f"missing expected columns: {missing}")


def write_atomic(df: pd.DataFrame, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", newline="") as fh:
            df.to_csv(fh, index=False)
        os.replace(tmp_path, path)
    except BaseException:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Update CSV snapshots from the Data Golf API.")
    parser.add_argument(
        "--datasets",
        default=",".join(DATASETS),
        help=f"Comma-separated subset of: {', '.join(DATASETS)} (default: all)",
    )
    parser.add_argument("--tour", default="pga", choices=["pga", "euro", "kft", "alt", "liv"])
    parser.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "data"))
    args = parser.parse_args()

    if not os.environ.get("DATAGOLF_KEY"):
        print("ERROR: DATAGOLF_KEY environment variable is not set.", file=sys.stderr)
        return 2

    selected = [name.strip() for name in args.datasets.split(",") if name.strip()]
    unknown = [name for name in selected if name not in DATASETS]
    if unknown:
        print(f"ERROR: unknown dataset(s): {unknown}", file=sys.stderr)
        return 2

    run_stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    failures = []
    for index, name in enumerate(selected):
        fetch_fn, filename, required_columns = DATASETS[name]
        if index > 0:
            time.sleep(SECONDS_BETWEEN_REQUESTS)
        try:
            df = fetch_fn(args.tour)
            validate(df, required_columns)
            df["updated_at"] = run_stamp
            out_path = os.path.join(args.out_dir, filename)
            write_atomic(df, out_path)
            print(f"[ok]   {name}: wrote {len(df)} rows -> {out_path}")
        except (DatasetError, KeyError, requests.RequestException) as err:
            failures.append(name)
            print(f"[fail] {name}: {err}", file=sys.stderr)

    if failures:
        print(f"\n{len(failures)}/{len(selected)} dataset(s) failed: {failures}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
