#!/usr/bin/env python3
"""
Pull EVERYTHING available from the Data Golf API into CSVs (one file per feed).

This is the "full dump" extractor: it hits every endpoint the API key's plan can
access with sensible default parameters and writes each feed to datagolf/data/.
Nested JSON is flattened; top-level scalar fields (event_name, last_updated, etc.)
are carried onto every row for context.

For the current-snapshot and list endpoints this needs no extra parameters. The
per-event detail feeds (historical rounds / odds / dfs points, pre-tournament
archive) require an event_id + year, so they are driven from the *-event-list*
files instead; pass --with-history to also pull the most recent N historical
events' round-level data.

Requires the DATAGOLF_KEY environment variable.

Usage:
    python datagolf/pull_all.py
    python datagolf/pull_all.py --tour pga --out-dir datagolf/data
    python datagolf/pull_all.py --with-history 3
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
SECONDS_BETWEEN_REQUESTS = 1.4  # ~43/min, under Data Golf's 45/min limit
MAX_RETRIES = 3
RETRY_STATUSES = {429, 500, 502, 503, 504}


class DatasetError(Exception):
    pass


def _fetch(path: str, params: dict):
    url = f"{BASE_URL}{path}"
    params = {**params, "key": os.environ["DATAGOLF_KEY"], "file_format": "json"}
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, params=params, timeout=30)
            if resp.status_code in RETRY_STATUSES:
                raise DatasetError(f"HTTP {resp.status_code}")
            if resp.status_code >= 400:
                raise DatasetError(f"HTTP {resp.status_code}: {resp.text[:120]}")
            return resp.json()
        except (requests.RequestException, DatasetError, ValueError) as err:
            last_error = err
            if attempt < MAX_RETRIES and isinstance(err, (requests.RequestException,)):
                time.sleep(2**attempt)
            elif attempt < MAX_RETRIES and "HTTP 5" in str(err) or "HTTP 429" in str(err):
                time.sleep(2**attempt)
            else:
                break
    raise DatasetError(f"GET {path} failed: {last_error}")


def flatten_hole_stats(data) -> list:
    rows = []
    for course in data.get("courses", []):
        for rnd in course.get("rounds", []):
            for hole in rnd.get("holes", []):
                row = {
                    "course_code": course.get("course_code"),
                    "course_key": course.get("course_key"),
                    "round_num": rnd.get("round_num"),
                }
                row.update(hole)
                rows.append(row)
    return rows


def to_frame(data, preferred_key) -> pd.DataFrame:
    """Normalize a Data Golf response into a flat DataFrame."""
    if callable(preferred_key):
        return pd.json_normalize(preferred_key(data))
    if isinstance(data, list):
        return pd.json_normalize(data)
    if not isinstance(data, dict):
        raise DatasetError(f"unexpected response type: {type(data).__name__}")

    scalars = {k: v for k, v in data.items() if not isinstance(v, (list, dict))}
    # Some feeds return a text message instead of a list when nothing is on offer
    # (e.g. matchups: "No tournament_matchups being offered right now.").
    if isinstance(preferred_key, str) and isinstance(data.get(preferred_key), str):
        return pd.DataFrame()
    key = preferred_key if (preferred_key in data and isinstance(data.get(preferred_key), list)) else None
    if key is None:
        for k, v in data.items():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                key = k
                break
    if key is None:
        raise DatasetError("no record list found in response")
    df = pd.json_normalize(data[key])
    for k, v in scalars.items():
        if k not in df.columns:
            df[k] = v
    return df


# name, path, params, record_key (str | callable | None for top-level array)
DATASETS = [
    ("players", "/get-player-list", {}, None),
    ("schedule", "/get-schedule", {"tour": "{tour}"}, "schedule"),
    ("field_updates", "/field-updates", {"tour": "{tour}"}, "field"),
    ("rankings", "/preds/get-dg-rankings", {}, "rankings"),
    ("pre_tournament", "/preds/pre-tournament", {"tour": "{tour}", "odds_format": "percent"}, "baseline"),
    ("skill_ratings", "/preds/skill-ratings", {"display": "value"}, "players"),
    ("approach_skill", "/preds/approach-skill", {"period": "l24"}, "data"),
    ("player_decompositions", "/preds/player-decompositions", {"tour": "{tour}"}, "players"),
    ("fantasy_projections", "/preds/fantasy-projection-defaults",
     {"tour": "{tour}", "site": "draftkings", "slate": "main"}, "projections"),
    ("in_play", "/preds/in-play", {"tour": "{tour}", "odds_format": "percent"}, "data"),
    ("live_tournament_stats", "/preds/live-tournament-stats", {"round": "event_cumulative"}, "live_stats"),
    ("live_strokes_gained", "/preds/live-strokes-gained", {"sg": "raw"}, "data"),
    ("live_hole_stats", "/preds/live-hole-stats", {"tour": "{tour}"}, flatten_hole_stats),
    ("outrights_win", "/betting-tools/outrights", {"tour": "{tour}", "market": "win", "odds_format": "decimal"}, "odds"),
    ("matchups", "/betting-tools/matchups",
     {"tour": "{tour}", "market": "tournament_matchups", "odds_format": "decimal"}, "match_list"),
    ("matchups_all_pairings", "/betting-tools/matchups-all-pairings", {"tour": "{tour}"}, "pairings"),
    ("hist_raw_event_list", "/historical-raw-data/event-list", {}, None),
    ("hist_results_event_list", "/historical-event-data/event-list", {"tour": "{tour}"}, None),
    ("hist_odds_event_list", "/historical-odds/event-list", {"tour": "{tour}"}, None),
    ("hist_dfs_event_list", "/historical-dfs-data/event-list", {"site": "draftkings"}, None),
]


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
    parser = argparse.ArgumentParser(description="Pull all accessible Data Golf feeds to CSV.")
    parser.add_argument("--tour", default="pga", choices=["pga", "euro", "kft", "alt", "liv"])
    parser.add_argument("--out-dir", default=os.path.join(os.path.dirname(__file__), "data"))
    parser.add_argument("--with-history", type=int, default=0, metavar="N",
                        help="Also pull round-level data for the N most recent historical events.")
    args = parser.parse_args()

    if not os.environ.get("DATAGOLF_KEY"):
        print("ERROR: DATAGOLF_KEY environment variable is not set.", file=sys.stderr)
        return 2

    run_stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    ok, failed = [], []

    for index, (name, path, raw_params, record_key) in enumerate(DATASETS):
        if index > 0:
            time.sleep(SECONDS_BETWEEN_REQUESTS)
        params = {k: (v.replace("{tour}", args.tour) if isinstance(v, str) else v) for k, v in raw_params.items()}
        try:
            data = _fetch(path, params)
            df = to_frame(data, record_key)
            if df.empty:
                print(f"[skip] {name}: no rows (likely no active event / off-season)")
                continue
            df.insert(0, "pulled_at", run_stamp)
            out_path = os.path.join(args.out_dir, f"dg_{name}.csv")
            write_atomic(df, out_path)
            ok.append(name)
            print(f"[ok]   {name}: {len(df)} rows, {len(df.columns)} cols -> {out_path}")
        except (DatasetError, requests.RequestException, KeyError) as err:
            failed.append(name)
            print(f"[fail] {name}: {err}", file=sys.stderr)

    if args.with_history:
        _pull_history(args, run_stamp, ok, failed)

    print(f"\nDone: {len(ok)} feed(s) written, {len(failed)} failed/unavailable.")
    if failed:
        print(f"Unavailable: {failed}")
    return 0


def _pull_history(args, run_stamp, ok, failed) -> None:
    """Pull round-level scoring for the most recent N historical events."""
    list_path = os.path.join(args.out_dir, "dg_hist_raw_event_list.csv")
    if not os.path.exists(list_path):
        print("[skip] history: event list not available", file=sys.stderr)
        return
    events = pd.read_csv(list_path)
    events = events[events["tour"] == args.tour] if "tour" in events.columns else events
    events = events.sort_values("date", ascending=False).head(args.with_history)
    frames = []
    for _, ev in events.iterrows():
        time.sleep(SECONDS_BETWEEN_REQUESTS)
        try:
            data = _fetch("/historical-raw-data/rounds",
                          {"tour": args.tour, "event_id": int(ev["event_id"]), "year": int(ev["calendar_year"])})
            df = to_frame(data, "scores")
            df["event_id"] = ev["event_id"]
            df["calendar_year"] = ev["calendar_year"]
            frames.append(df)
            print(f"[ok]   history {ev['event_id']}/{ev['calendar_year']}: {len(df)} rows")
        except (DatasetError, requests.RequestException, KeyError) as err:
            print(f"[fail] history {ev.get('event_id')}: {err}", file=sys.stderr)
    if frames:
        combined = pd.concat(frames, ignore_index=True)
        combined.insert(0, "pulled_at", run_stamp)
        out_path = os.path.join(args.out_dir, "dg_hist_rounds.csv")
        write_atomic(combined, out_path)
        ok.append("hist_rounds")
        print(f"[ok]   hist_rounds: {len(combined)} rows -> {out_path}")


if __name__ == "__main__":
    sys.exit(main())
