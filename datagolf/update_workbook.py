#!/usr/bin/env python3
"""
Update the "PGA stat caddy" workbook with new tournament weeks from Data Golf.

The workbook tracks rolling windows of per-round strokes-gained per player:
  - "Current Form"  : SG total, last 10 weeks, Form = TRIMMEAN(B:K, 2/COUNT)
  - "SG OTT/APP/ARG/PUTT" : SG components, last 15 weeks, same TRIMMEAN pattern
  - "DG Points"     : requires Data Golf's historical tier; left blank for new weeks

For each new week this script shifts every sheet's date window left (dropping the
oldest week) and writes the new week's values in the last date column, so the
TRIMMEAN formulas and the PGA Database cross-references stay untouched.

Week data sources:
  --live            : current event's final stats from /preds/live-tournament-stats
                      (round=event_avg -> already per-round)
  --snapshot DIR    : a committed pull_all.py snapshot (dg_live_tournament_stats.csv
                      cumulative SG divided by rounds played from dg_in_play.csv)

Usage:
    python datagolf/update_workbook.py workbook.xlsx out.xlsx \
        --snapshot datagolf/data --snapshot-date 2026-07-12 \
        --live --live-date 2026-07-19
"""

import argparse
import os
import re
import sys
import unicodedata
from datetime import datetime

import openpyxl
import pandas as pd
import requests

STAT_SHEETS = {
    "SG OTT": "sg_ott",
    "SG APP": "sg_app",
    "SG ARG": "sg_arg",
    "SG PUTT": "sg_putt",
    "Current Form": "sg_total",
    "DG Points": None,  # no accessible source; window shifts, values stay blank
}


def norm_name(name: str) -> str:
    """Normalize 'Ludvig Aberg  ' / 'Aberg, Ludvig' to a comparable key."""
    name = str(name).strip()
    if "," in name:
        last, first = [p.strip() for p in name.split(",", 1)]
        name = f"{first} {last}"
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", name).lower()


def week_from_live(api_key: str) -> dict:
    """Per-round SG averages for the current event, keyed by normalized name."""
    resp = requests.get(
        "https://feeds.datagolf.com/preds/live-tournament-stats",
        params={
            "stats": "sg_ott,sg_app,sg_arg,sg_putt,sg_total",
            "round": "event_avg",
            "display": "value",
            "file_format": "json",
            "key": api_key,
        },
        timeout=30,
    )
    resp.raise_for_status()
    payload = resp.json()
    print(f"live event: {payload.get('event_name')} (updated {payload.get('last_updated')})")
    out = {}
    for p in payload.get("live_stats") or []:
        out[norm_name(p["player_name"])] = {
            stat: p.get(stat) for stat in ("sg_ott", "sg_app", "sg_arg", "sg_putt", "sg_total")
        }
    return out


def week_from_snapshot(snapshot_dir: str) -> dict:
    """Per-round SG from a pull_all.py snapshot (cumulative / rounds played)."""
    stats = pd.read_csv(os.path.join(snapshot_dir, "dg_live_tournament_stats.csv"))
    inplay = pd.read_csv(os.path.join(snapshot_dir, "dg_in_play.csv"))
    print(f"snapshot event: {stats['event_name'].iloc[0]}")
    rounds = inplay.set_index("dg_id")[["R1", "R2", "R3", "R4"]].notna().sum(axis=1)
    out = {}
    for _, row in stats.iterrows():
        n = int(rounds.get(row["dg_id"], 0)) or None
        if n is None:
            continue
        out[norm_name(row["player_name"])] = {
            stat: (row[stat] / n if pd.notna(row.get(stat)) else None)
            for stat in ("sg_ott", "sg_app", "sg_arg", "sg_putt", "sg_total")
        }
    return out


def week_from_archive(api_key: str, week: str) -> dict:
    """Official per-round SG averages for every event completing on `week` (Sunday).

    Merges all events that week (main + opposite field). Preferred over live capture
    once Data Golf archives the event, since archived SG reflects their final revisions.
    """
    listing = requests.get(
        "https://feeds.datagolf.com/historical-event-data/event-list",
        params={"tour": "pga", "file_format": "json", "key": api_key}, timeout=30,
    ).json()
    out = {}
    for ev in listing:
        if ev.get("date") != week:
            continue
        detail = requests.get(
            "https://feeds.datagolf.com/historical-raw-data/rounds",
            params={"tour": "pga", "event_id": ev["event_id"], "year": ev["calendar_year"],
                    "file_format": "json", "key": api_key}, timeout=30,
        ).json()
        for p in detail.get("scores", []):
            rounds = [p[k] for k in ("round_1", "round_2", "round_3", "round_4")
                      if isinstance(p.get(k), dict)]
            rec = {}
            for stat in ("sg_ott", "sg_app", "sg_arg", "sg_putt", "sg_total"):
                vals = [r[stat] for r in rounds if r.get(stat) is not None]
                if vals:
                    rec[stat] = sum(vals) / len(vals)
            if rec:
                out[norm_name(p["player_name"])] = rec
        print(f"  archive {week}: {ev['event_name']} -> {len(detail.get('scores', []))} players")
    return out


def fetch_dg_points_by_week(api_key: str, weeks: list) -> dict:
    """dg_points per player for each week-ending Sunday, merging all events that week."""
    listing = requests.get(
        "https://feeds.datagolf.com/historical-event-data/event-list",
        params={"tour": "pga", "file_format": "json", "key": api_key}, timeout=30,
    ).json()
    by_week = {}
    for wk in weeks:
        by_week[wk] = {}
        for ev in listing:
            if ev.get("date") == wk:
                detail = requests.get(
                    "https://feeds.datagolf.com/historical-event-data/events",
                    params={"tour": "pga", "event_id": ev["event_id"], "year": ev["calendar_year"],
                            "file_format": "json", "key": api_key}, timeout=30,
                ).json()
                for p in detail.get("event_stats", []):
                    if p.get("dg_points") is not None:
                        by_week[wk][norm_name(p["player_name"])] = round(float(p["dg_points"]), 2)
                print(f"  dg_points {wk}: {ev['event_name']} -> {len(detail.get('event_stats', []))} players")
    return by_week


def fill_dg_points(ws, api_key: str) -> None:
    """Fill any completely-empty week columns in the DG Points sheet from the archive."""
    cols = date_columns(ws)
    player_rows = [r for r in range(2, ws.max_row + 1) if ws.cell(row=r, column=1).value not in (None, "")]
    empty = [(c, d) for c, d in cols
             if all(ws.cell(row=r, column=c).value in (None, "") for r in player_rows)]
    if not empty:
        print("[ok] DG Points: no empty week columns")
        return
    weeks = [d.date().isoformat() for _, d in empty]
    data = fetch_dg_points_by_week(api_key, weeks)
    filled = 0
    for c, d in empty:
        wk = d.date().isoformat()
        for r in player_rows:
            v = data.get(wk, {}).get(norm_name(ws.cell(row=r, column=1).value))
            if v is not None:
                ws.cell(row=r, column=c).value = v
                filled += 1
    print(f"[ok] DG Points: filled {filled} cells across {len(empty)} week(s)")


def fill_course_fit(ws, api_key: str, column_header: str = "T2Green") -> None:
    """Write Data Golf's course-fit adjustment for the upcoming event into PGA Database."""
    d = requests.get(
        "https://feeds.datagolf.com/preds/player-decompositions",
        params={"tour": "pga", "file_format": "json", "key": api_key}, timeout=30,
    ).json()
    fit = {norm_name(p["player_name"]): p.get("total_fit_adjustment") for p in d.get("players", [])}
    print(f"course fit source: {d.get('event_name')} at {d.get('course_name')} ({len(fit)} players)")
    col = next((c.column for c in ws[1] if str(c.value).strip() == column_header), None)
    if col is None:
        raise SystemExit(f"column {column_header!r} not found in {ws.title}")
    hits = 0
    for r in range(2, ws.max_row + 1):
        name = ws.cell(row=r, column=1).value
        if name in (None, ""):
            continue
        v = fit.get(norm_name(name))
        if v is not None:
            ws.cell(row=r, column=col).value = round(float(v), 2)
            hits += 1
        else:
            ws.cell(row=r, column=col).value = None  # not in this week's field: clear stale fit
    print(f"[ok] {ws.title}.{column_header}: course fit set for {hits} field players, others cleared")


def date_columns(ws) -> list:
    """(column_index, datetime) pairs for the date headers in row 1."""
    cols = []
    for cell in ws[1]:
        if isinstance(cell.value, datetime):
            cols.append((cell.column, cell.value))
    return cols


def update_sheet(ws, new_weeks: list, stat: str) -> tuple:
    """Shift the sheet's date window and write new week values. Returns (hits, misses)."""
    cols = date_columns(ws)
    if not cols:
        raise SystemExit(f"{ws.title}: no date headers found in row 1")
    col_indexes = [c for c, _ in cols]
    existing_dates = [d for _, d in cols]

    all_dates = existing_dates + [d for d, _ in new_weeks if d not in existing_dates]
    all_dates.sort()
    window = all_dates[-len(col_indexes):]

    player_rows = [r for r in range(2, ws.max_row + 1) if ws.cell(row=r, column=1).value not in (None, "")]

    # Snapshot current values by (player, date) before overwriting.
    current = {}
    for r in player_rows:
        for (c, d) in cols:
            current[(r, d)] = ws.cell(row=r, column=c).value
    new_data = {d: values for d, values in new_weeks}

    hits = misses = 0
    matched_names = set()
    for r in player_rows:
        key = norm_name(ws.cell(row=r, column=1).value)
        for c, d in zip(col_indexes, window):
            ws.cell(row=1, column=c).value = d
            if d in new_data:
                if stat is None:
                    value = None
                else:
                    rec = new_data[d].get(key)
                    value = None if rec is None or rec.get(stat) is None else round(float(rec[stat]), 2)
                    if rec is not None:
                        matched_names.add(key)
            else:
                value = current.get((r, d))
            ws.cell(row=r, column=c).value = value
    if stat is not None and new_weeks:
        all_players = set().union(*(set(v) for _, v in new_weeks))
        hits = len(matched_names)
        misses = len(all_players - matched_names)
    return hits, misses


def main() -> int:
    parser = argparse.ArgumentParser(description="Update StatCaddy workbook from Data Golf.")
    parser.add_argument("workbook")
    parser.add_argument("output")
    parser.add_argument("--snapshot", help="pull_all.py snapshot dir for a completed event")
    parser.add_argument("--snapshot-date", help="Week (Sunday) YYYY-MM-DD for the snapshot event")
    parser.add_argument("--live", action="store_true", help="Fetch current event live from Data Golf")
    parser.add_argument("--live-date", help="Week (Sunday) YYYY-MM-DD for the live event")
    parser.add_argument("--archive-date", action="append", default=[],
                        help="Week (Sunday) YYYY-MM-DD to fill/refresh from the official archive (repeatable)")
    parser.add_argument("--dg-points", action="store_true",
                        help="Fill empty DG Points week columns from the historical archive (needs historical tier)")
    parser.add_argument("--course-fit", action="store_true",
                        help="Refresh PGA Database T2Green with course fit for the upcoming event")
    args = parser.parse_args()

    new_weeks = []
    if args.snapshot:
        if not args.snapshot_date:
            parser.error("--snapshot requires --snapshot-date")
        new_weeks.append((datetime.fromisoformat(args.snapshot_date), week_from_snapshot(args.snapshot)))
    if args.live:
        if not args.live_date:
            parser.error("--live requires --live-date")
        if not os.environ.get("DATAGOLF_KEY"):
            print("ERROR: DATAGOLF_KEY not set", file=sys.stderr)
            return 2
        new_weeks.append((datetime.fromisoformat(args.live_date), week_from_live(os.environ["DATAGOLF_KEY"])))
    for wk in args.archive_date:
        data = week_from_archive(os.environ["DATAGOLF_KEY"], wk)
        if not data:
            print(f"ERROR: archive has no events completing {wk} yet — aborting so the "
                  f"workbook is not written with an empty week.", file=sys.stderr)
            return 3
        new_weeks.append((datetime.fromisoformat(wk), data))
    if not new_weeks and not (args.dg_points or args.course_fit):
        parser.error("nothing to do: pass --snapshot/--live and/or --dg-points/--course-fit")
    empty = [d for d, v in new_weeks if not v]
    for d in empty:
        print(f"[skip] {d.date()}: no event data for that week (off week?) — not adding a column")
    new_weeks = [(d, v) for d, v in new_weeks if v]
    new_weeks.sort(key=lambda x: x[0])

    wb = openpyxl.load_workbook(args.workbook, data_only=False)
    if new_weeks:
        for sheet_name, stat in STAT_SHEETS.items():
            if sheet_name not in wb.sheetnames:
                print(f"[warn] sheet {sheet_name!r} not found, skipping")
                continue
            hits, misses = update_sheet(wb[sheet_name], new_weeks, stat)
            note = "(window shifted)" if stat is None else f"matched {hits} sheet players; {misses} DG players not in sheet"
            print(f"[ok] {sheet_name}: {note}")

    if args.dg_points:
        fill_dg_points(wb["DG Points"], os.environ["DATAGOLF_KEY"])
    if args.course_fit:
        fill_course_fit(wb["PGA Database"], os.environ["DATAGOLF_KEY"])

    wb.save(args.output)
    print(f"\nSaved: {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
