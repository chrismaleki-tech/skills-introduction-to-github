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
    if not new_weeks:
        parser.error("nothing to do: pass --snapshot and/or --live")
    new_weeks.sort(key=lambda x: x[0])

    wb = openpyxl.load_workbook(args.workbook, data_only=False)
    for sheet_name, stat in STAT_SHEETS.items():
        if sheet_name not in wb.sheetnames:
            print(f"[warn] sheet {sheet_name!r} not found, skipping")
            continue
        hits, misses = update_sheet(wb[sheet_name], new_weeks, stat)
        note = "(window shifted, values need historical tier)" if stat is None else f"matched {hits} sheet players; {misses} DG players not in sheet"
        print(f"[ok] {sheet_name}: {note}")

    wb.save(args.output)
    print(f"\nSaved: {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
