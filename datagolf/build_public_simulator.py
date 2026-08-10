#!/usr/bin/env python3
"""
Regenerate the public "Build Your Own Matchup Model" simulator and (optionally)
push it to the live WordPress page.

Preferred data source is the member-field export
``datagolf/workbooks/StatCaddy_Field_latest.csv`` (same players/stats as the
member pick list). Columns map to widget keys: Player→name, SG OTT→ott,
Points→pts, Approach→app, Putting→putt, Around Green→arg, Form→form,
History→hist. (T2Green / fit is omitted — the public STATS list has no fit slot.)

Falls back to the workbook's PGA Database sheet (players with a T2Green value)
only when that CSV is missing.

An embeddable, WordPress-safe HTML block is built (scoped CSS + base64 JS +
inline JSON), and — if WordPress credentials are present — the block is written
to the simulator page via REST.

Env (only needed for the push step):
    WP_URL, WP_USERNAME, WP_APP_PASSWORD
    WP_SIMULATOR_PAGE_ID   (defaults to 4952)

Usage:
    python datagolf/build_public_simulator.py --workbook datagolf/workbooks/PGA_stat_caddy_latest.xlsx
    python datagolf/build_public_simulator.py --push        # also update the live page
"""

import argparse
import base64
import csv
import json
import os
import re
import sys

import openpyxl
import requests

REPO_DIR = os.path.dirname(__file__)
SIM_DIR = os.path.join(os.path.dirname(REPO_DIR), "simulator")
TEMPLATE = os.path.join(SIM_DIR, "statcaddy-simulator-standalone.html")
FIELD_CSV = os.path.join(REPO_DIR, "workbooks", "StatCaddy_Field_latest.csv")

# CSV / PGA Database column header -> widget stat key
# (fit/T2Green omitted — public STATS template has no fit key)
COLMAP = {
    "SG OTT": "ott", "Approach": "app", "Around Green": "arg", "Putting": "putt",
    "Form": "form", "History": "hist", "Points": "pts",
}


def _record_from_row(name: str, get_value) -> dict | None:
    """Build one player dict from a name + value getter; None if any stat missing."""
    rec = {"name": str(name).strip()}
    for header, key in COLMAP.items():
        v = get_value(header)
        try:
            rec[key] = round(float(v), 3)
        except (TypeError, ValueError):
            return None
    return rec


def build_players_from_csv(csv_path: str) -> list:
    players = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("Player") or "").strip()
            if not name:
                continue
            rec = _record_from_row(name, lambda h, r=row: r.get(h))
            if rec:
                players.append(rec)
    players.sort(key=lambda p: p["name"])
    return players


def build_players_from_workbook(workbook: str) -> list:
    wb = openpyxl.load_workbook(workbook, data_only=True)
    db = wb["PGA Database"]
    hdr = {str(c.value).strip(): i + 1 for i, c in enumerate(db[1]) if c.value}
    fit_col = hdr.get("T2Green")
    players = []
    for r in range(2, db.max_row + 1):
        name = db.cell(row=r, column=1).value
        if not name:
            continue
        if fit_col and db.cell(row=r, column=fit_col).value is None:
            continue  # not in this week's field
        rec = _record_from_row(
            name,
            lambda h, row=r: db.cell(row=row, column=hdr[h]).value if h in hdr else None,
        )
        if rec:
            players.append(rec)
    players.sort(key=lambda p: p["name"])
    return players


def build_players(workbook: str, field_csv: str | None = None) -> list:
    csv_path = field_csv if field_csv is not None else FIELD_CSV
    if os.path.isfile(csv_path):
        players = build_players_from_csv(csv_path)
        print(f"[ok] field source: {csv_path} ({len(players)} players)")
        return players
    print(f"[warn] {csv_path} missing — falling back to workbook T2Green field")
    return build_players_from_workbook(workbook)


def build_embed(players: list) -> str:
    html = open(TEMPLATE).read()
    # set default matchup to the first two current-field players
    if len(players) >= 2:
        html = re.sub(r'(<input list="pl" id="p1"[^>]*value=")[^"]*(")',
                      rf'\g<1>{players[0]["name"]}\g<2>', html)
        html = re.sub(r'(<input list="pl" id="p2"[^>]*value=")[^"]*(")',
                      rf'\g<1>{players[1]["name"]}\g<2>', html)
    style = re.sub(r"\s+", " ", re.search(r"<style>(.*?)</style>", html, re.S).group(1).replace("body {", "#sc-sim {"))
    body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
    js = re.search(r"<script>(.*?)</script>", body, re.S).group(1)
    markup = re.sub(r"\n\s*\n+", "\n", re.sub(r"<script.*?</script>", "", body, flags=re.S))
    data = json.dumps(players, separators=(",", ":"))
    return (f'<div id="sc-sim"><style>{style}</style>{markup}'
            f'<script type="application/json" id="embedded-data">{data}</script>'
            f'<script>eval(atob("{base64.b64encode(js.encode()).decode()}"));</script></div>')


def push_to_wordpress(embed: str) -> None:
    url = os.environ["WP_URL"].rstrip("/")
    page_id = os.environ.get("WP_SIMULATOR_PAGE_ID", "4952")
    auth = (os.environ["WP_USERNAME"], os.environ["WP_APP_PASSWORD"].replace(" ", ""))
    r = requests.post(f"{url}/wp-json/wp/v2/pages/{page_id}", auth=auth,
                      json={"content": embed}, timeout=60)
    r.raise_for_status()
    n = len(json.loads(re.search(r'id="embedded-data">(.*?)</script>', r.json()["content"]["rendered"], re.S).group(1)))
    print(f"[ok] pushed to WordPress page {page_id}: {n} players live")


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild the public matchup simulator.")
    parser.add_argument("--workbook", default=os.path.join(REPO_DIR, "workbooks", "PGA_stat_caddy_latest.xlsx"))
    parser.add_argument("--field-csv", default=FIELD_CSV,
                        help="Member-field CSV (default: StatCaddy_Field_latest.csv). "
                             "Falls back to workbook T2Green if missing.")
    parser.add_argument("--push", action="store_true", help="Also update the live WordPress page.")
    args = parser.parse_args()

    players = build_players(args.workbook, field_csv=args.field_csv)
    if len(players) < 2:
        print(f"ERROR: only {len(players)} field players found — aborting.", file=sys.stderr)
        return 1
    embed = build_embed(players)
    json.dump(players, open(os.path.join(SIM_DIR, "players.json"), "w"), indent=0)
    open(os.path.join(SIM_DIR, "wp-embed.html"), "w").write(embed)
    print(f"[ok] rebuilt simulator with {len(players)} field players (default: {players[0]['name']} vs {players[1]['name']})")

    if args.push:
        if not all(os.environ.get(v) for v in ("WP_URL", "WP_USERNAME", "WP_APP_PASSWORD")):
            print("ERROR: --push requires WP_URL / WP_USERNAME / WP_APP_PASSWORD", file=sys.stderr)
            return 2
        push_to_wordpress(embed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
