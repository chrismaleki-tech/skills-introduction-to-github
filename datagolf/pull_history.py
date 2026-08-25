#!/usr/bin/env python3
"""
Pull Data Golf's historical round-level stats for whole seasons into one CSV.

`pull_all.py` takes a snapshot of what the API is serving *right now*. This
script goes the other way: it walks the historical event list, fetches
/historical-raw-data/rounds for every event in the requested calendar years,
and writes one row per player per round to a single CSV.

Every stat Data Golf records for a round is a column: the score and its
breakdown (birdies, bogies, pars, eagles, doubles), the traditional stats
(driving distance and accuracy, GIR, scrambling, proximity from fairway and
rough), and strokes gained both in total and split by category (off the tee,
approach, around the green, putting, tee-to-green).

Score and total strokes gained come back for every tour, because the total only
needs a score measured against the field. The rest depends on Data Golf having
shot-level data, which it has for a minority of the events it lists. Those
events still contribute their rows, and the stats they do not carry are left
empty rather than zero — a zero would read as an average round rather than an
unmeasured one. `sg_categories` and `traditional_stats` on each row say which
case it is, so one schema covers every tour without hiding the difference.

Responses are cached under the output directory, so an interrupted run resumes
from where it stopped instead of re-paying for a thousand requests. Only the
network phase is throttled; rebuilding the CSV from a warm cache is immediate.

Requires the DATAGOLF_KEY environment variable.

Usage:
    python datagolf/pull_history.py                          # 2024-2026, every tour
    python datagolf/pull_history.py --years 2025
    python datagolf/pull_history.py --years 2024,2025 --tours pga,euro
    python datagolf/pull_history.py --out /tmp/stats.csv
"""

import argparse
import csv
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone

import requests

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

BASE_URL = os.environ.get("DATAGOLF_BASE_URL", "https://feeds.datagolf.com")
SECONDS_BETWEEN_REQUESTS = 1.4  # ~43/min, under Data Golf's 45/min limit
MAX_RETRIES = 4
RETRY_STATUSES = {429, 500, 502, 503, 504}

DEFAULT_YEARS = (2024, 2025, 2026)

EVENT_LIST_PATH = "/historical-raw-data/event-list"
ROUNDS_PATH = "/historical-raw-data/rounds"

# Context carried onto every row, in the order it should appear.
EVENT_COLUMNS = [
    "tour",
    "calendar_year",
    "season",
    "event_id",
    "event_name",
    "event_date",
    "event_completed",
    "sg_categories",
    "traditional_stats",
]
PLAYER_COLUMNS = ["dg_id", "player_name", "fin_text"]
ROUND_COLUMNS = ["round_num"]

# The round-level stats, grouped the way Data Golf presents them. Anything the
# API adds later is appended alphabetically by `build_header` rather than lost.
KNOWN_ROUND_STATS = [
    "course_name",
    "course_num",
    "course_par",
    "start_hole",
    "teetime",
    "score",
    "birdies",
    "bogies",
    "pars",
    "eagles_or_better",
    "doubles_or_worse",
    "driving_dist",
    "driving_acc",
    "gir",
    "scrambling",
    "prox_fw",
    "prox_rgh",
    "great_shots",
    "poor_shots",
    "sg_ott",
    "sg_app",
    "sg_arg",
    "sg_putt",
    "sg_t2g",
    "sg_total",
]


class DatasetError(Exception):
    pass


def fetch(path: str, params: dict) -> object:
    """GET a Data Golf endpoint, retrying the failures that are worth retrying."""
    url = f"{BASE_URL}{path}"
    params = {**params, "key": os.environ["DATAGOLF_KEY"], "file_format": "json"}
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, params=params, timeout=60)
            if resp.status_code in RETRY_STATUSES:
                raise DatasetError(f"HTTP {resp.status_code}")
            if resp.status_code >= 400:
                # 4xx other than 429 means this request will never succeed.
                raise PermissionError(f"HTTP {resp.status_code}: {resp.text[:160]}")
            return resp.json()
        except PermissionError:
            raise
        except (requests.RequestException, DatasetError, ValueError) as err:
            last_error = err
            if attempt < MAX_RETRIES:
                time.sleep(2**attempt)
    raise DatasetError(f"GET {path} failed after {MAX_RETRIES} attempts: {last_error}")


def round_number(key: str):
    """`round_3` -> 3. Returns None for keys that are not rounds."""
    if not key.startswith("round_"):
        return None
    suffix = key[len("round_"):]
    return int(suffix) if suffix.isdigit() else None


def event_rows(event: dict, payload: dict):
    """Yield one row per player per round played at an event."""
    scores = payload.get("scores")
    if not isinstance(scores, list):
        return
    context = {
        "tour": payload.get("tour") or event.get("tour"),
        "calendar_year": event.get("calendar_year") or payload.get("year"),
        "season": payload.get("season"),
        "event_id": event.get("event_id") or payload.get("event_id"),
        "event_name": payload.get("event_name") or event.get("event_name"),
        "event_date": event.get("date"),
        "event_completed": payload.get("event_completed"),
        "sg_categories": payload.get("sg_categories") or event.get("sg_categories"),
        "traditional_stats": payload.get("traditional_stats") or event.get("traditional_stats"),
    }
    for player in scores:
        if not isinstance(player, dict):
            continue
        identity = {
            "dg_id": player.get("dg_id"),
            "player_name": player.get("player_name"),
            "fin_text": player.get("fin_text"),
        }
        rounds = sorted(
            (num, value)
            for key, value in player.items()
            if (num := round_number(key)) is not None and isinstance(value, dict)
        )
        for num, stats in rounds:
            row = {**context, **identity, "round_num": num}
            row.update({k: v for k, v in stats.items() if not isinstance(v, (list, dict))})
            yield row


def build_header(extra_stats) -> list:
    """The fixed columns first, then any stat the API grew since this was written."""
    unexpected = sorted(set(extra_stats) - set(KNOWN_ROUND_STATS))
    return EVENT_COLUMNS + PLAYER_COLUMNS + ROUND_COLUMNS + KNOWN_ROUND_STATS + unexpected


def select_events(events, years, tours) -> list:
    """Events in the requested years/tours, oldest first so the CSV reads chronologically."""
    chosen = [
        e for e in events
        if e.get("calendar_year") in years and (tours is None or e.get("tour") in tours)
    ]
    return sorted(chosen, key=lambda e: (str(e.get("date") or ""), str(e.get("tour")), e.get("event_id") or 0))


def cache_path(cache_dir: str, event: dict) -> str:
    return os.path.join(cache_dir, f"{event['calendar_year']}_{event['tour']}_{event['event_id']}.json")


def load_cached(path: str):
    try:
        with open(path) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def write_atomic_json(payload, path: str) -> None:
    fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(payload, fh)
        os.replace(tmp_path, path)
    except BaseException:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


def download(events, cache_dir, refresh: bool) -> dict:
    """Fill the cache for every event. Returns event key -> failure reason for the misses."""
    os.makedirs(cache_dir, exist_ok=True)
    failures = {}
    requested = 0
    total = len(events)
    for index, event in enumerate(events, start=1):
        path = cache_path(cache_dir, event)
        label = f"{event['calendar_year']} {event['tour']:>5} {event['event_id']:>8} {str(event.get('event_name'))[:48]}"
        if not refresh and os.path.exists(path) and load_cached(path) is not None:
            continue
        if requested:
            time.sleep(SECONDS_BETWEEN_REQUESTS)
        requested += 1
        try:
            payload = fetch(ROUNDS_PATH, {
                "tour": event["tour"],
                "event_id": event["event_id"],
                "year": event["calendar_year"],
            })
        except (DatasetError, PermissionError, requests.RequestException) as err:
            failures[path] = str(err)
            print(f"[fail] {index}/{total} {label}: {err}", file=sys.stderr, flush=True)
            continue
        if not isinstance(payload, dict) or not isinstance(payload.get("scores"), list):
            failures[path] = "no scores in response"
            print(f"[skip] {index}/{total} {label}: no scores in response", flush=True)
            continue
        write_atomic_json(payload, path)
        print(f"[ok]   {index}/{total} {label}: {len(payload['scores'])} players", flush=True)
    return failures


def collect_stat_keys(events, cache_dir) -> set:
    keys = set()
    for event in events:
        payload = load_cached(cache_path(cache_dir, event))
        if not isinstance(payload, dict):
            continue
        for player in payload.get("scores") or []:
            if not isinstance(player, dict):
                continue
            for key, value in player.items():
                if round_number(key) is not None and isinstance(value, dict):
                    keys.update(k for k, v in value.items() if not isinstance(v, (list, dict)))
    return keys


def write_csv(events, cache_dir, out_path, pulled_at) -> tuple:
    header = ["pulled_at"] + build_header(collect_stat_keys(events, cache_dir))
    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(out_path)), suffix=".tmp")
    rows = 0
    events_written = 0
    try:
        with os.fdopen(fd, "w", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=header, extrasaction="ignore")
            writer.writeheader()
            for event in events:
                payload = load_cached(cache_path(cache_dir, event))
                if not isinstance(payload, dict):
                    continue
                before = rows
                for row in event_rows(event, payload):
                    row["pulled_at"] = pulled_at
                    writer.writerow(row)
                    rows += 1
                if rows > before:
                    events_written += 1
        os.replace(tmp_path, out_path)
    except BaseException:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise
    return rows, events_written, header


def parse_years(raw: str) -> set:
    try:
        return {int(part) for part in raw.split(",") if part.strip()}
    except ValueError:
        raise argparse.ArgumentTypeError(f"years must be a comma-separated list of numbers, got {raw!r}")


HISTORY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "history")


def default_out_path(years) -> str:
    span = f"{min(years)}_{max(years)}" if len(years) > 1 else f"{min(years)}"
    return os.path.join(HISTORY_DIR, f"dg_stats_{span}.csv")


def main() -> int:
    parser = argparse.ArgumentParser(description="Pull Data Golf historical round-level stats to one CSV.")
    parser.add_argument("--years", type=parse_years, default=set(DEFAULT_YEARS),
                        help="Comma-separated calendar years (default: 2024,2025,2026).")
    parser.add_argument("--tours", default="all",
                        help="Comma-separated tour codes, or 'all' (default) for every tour Data Golf covers.")
    parser.add_argument("--out", default=None,
                        help="Path of the CSV to write (default: data/history/dg_stats_<years>.csv).")
    parser.add_argument("--cache-dir", default=os.path.join(HISTORY_DIR, "_cache"),
                        help="Where raw responses are cached. Belongs to the dataset rather than to "
                             "any one CSV, so writing elsewhere with --out still reuses it.")
    parser.add_argument("--refresh", action="store_true",
                        help="Re-fetch events already in the cache (use for years still in progress).")
    parser.add_argument("--skip-download", action="store_true",
                        help="Rebuild the CSV from the cache without hitting the API.")
    args = parser.parse_args()

    if not os.environ.get("DATAGOLF_KEY"):
        print("ERROR: DATAGOLF_KEY environment variable is not set.", file=sys.stderr)
        return 2

    if not args.years:
        print("ERROR: --years needs at least one year.", file=sys.stderr)
        return 2
    out_path = args.out or default_out_path(args.years)
    tours = None if args.tours.strip().lower() == "all" else {t.strip() for t in args.tours.split(",") if t.strip()}
    cache_dir = args.cache_dir
    pulled_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    try:
        catalog = fetch(EVENT_LIST_PATH, {})
    except (DatasetError, PermissionError, requests.RequestException) as err:
        print(f"ERROR: could not read the historical event list: {err}", file=sys.stderr)
        return 1
    if not isinstance(catalog, list):
        print("ERROR: historical event list did not return a list of events.", file=sys.stderr)
        return 1

    events = select_events(catalog, args.years, tours)
    if not events:
        print(f"ERROR: no events match years={sorted(args.years)} tours={args.tours}.", file=sys.stderr)
        return 1
    print(f"{len(events)} event(s) across {len({e['tour'] for e in events})} tour(s) "
          f"for {sorted(args.years)}\n")

    failures = {} if args.skip_download else download(events, cache_dir, args.refresh)

    # Writing a header-only CSV over a good one would look like a successful run.
    if not any(os.path.exists(cache_path(cache_dir, e)) for e in events):
        hint = ("drop --skip-download to fetch them" if args.skip_download
                else "every request failed; check DATAGOLF_KEY and the network")
        print(f"ERROR: no response cached under {cache_dir} for any selected event — {hint}.",
              file=sys.stderr)
        return 1

    rows, events_written, header = write_csv(events, cache_dir, out_path, pulled_at)
    size_mb = os.path.getsize(out_path) / 1e6
    print(f"\nWrote {rows:,} rows x {len(header)} columns from {events_written:,}/{len(events):,} events "
          f"-> {out_path} ({size_mb:.1f} MB)")
    if failures:
        print(f"{len(failures)} event(s) unavailable and left out of the CSV.", file=sys.stderr)
    return 0 if rows else 1


if __name__ == "__main__":
    sys.exit(main())
