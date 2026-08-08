#!/usr/bin/env python3
"""
Regenerate the public "Build Your Own Matchup Model" simulator and (optionally)
push it to the live WordPress page.

Data source is the workbook's PGA Database sheet: the current field is the set of
players that have a course-fit (T2Green) value set for the upcoming event. Each
player's 7 widget stats are read from that sheet, an embeddable, WordPress-safe
HTML block is built (scoped CSS + base64 JS + inline JSON), and — if WordPress
credentials are present — the block is written to the simulator page via REST.

Env (only needed for the push step):
    WP_URL, WP_USERNAME, WP_APP_PASSWORD
    WP_SIMULATOR_PAGE_ID   (defaults to 4952)

Usage:
    python datagolf/build_public_simulator.py --workbook datagolf/workbooks/PGA_stat_caddy_latest.xlsx
    python datagolf/build_public_simulator.py --push        # also update the live page
"""

import argparse
import base64
import json
import os
import re
import sys

import openpyxl
import requests

REPO_DIR = os.path.dirname(__file__)
SIM_DIR = os.path.join(os.path.dirname(REPO_DIR), "simulator")
TEMPLATE = os.path.join(SIM_DIR, "statcaddy-simulator-standalone.html")

# PGA Database column header -> widget stat key
COLMAP = {
    "SG OTT": "ott", "Approach": "app", "Around Green": "arg", "Putting": "putt",
    "T2Green": "fit", "Form": "form", "History": "hist", "Points": "pts",
}


def build_players(workbook: str) -> list:
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
        rec = {"name": str(name).strip()}
        ok = True
        for header, key in COLMAP.items():
            col = hdr.get(header)
            v = db.cell(row=r, column=col).value if col else None
            try:
                rec[key] = round(float(v), 3)
            except (TypeError, ValueError):
                ok = False
                break
        if ok:
            players.append(rec)
    players.sort(key=lambda p: p["name"])
    return players


PAGE_WRAPPER_CSS = (
    "<style>"
    "body.page-id-4952 .page-header,body.postid-4952 .page-header{display:none!important;}"
    "body.page-id-4952 #content.site-main,body.postid-4952 #content.site-main{"
    "padding-top:140px!important;overflow:visible!important;}"
    "body.page-id-4952 .page-content,body.postid-4952 .page-content{overflow:visible!important;}"
    "#sc-sim br{display:none!important;}"
    "#sc-sim p{display:contents!important;margin:0!important;}"
    "#sc-sim .presets{display:flex!important;flex-wrap:nowrap!important;gap:8px!important;width:100%!important;}"
    "#sc-sim .presets button{flex:1 1 0!important;width:auto!important;max-width:none!important;"
    "min-width:0!important;}"
    "</style>"
)


def build_embed(players: list) -> str:
    html = open(TEMPLATE).read()
    # Seed default selected players on the <select> elements when present.
    if len(players) >= 2:
        p1, p2 = players[0]["name"], players[1]["name"]
        html = re.sub(
            r'(<select id="p1"[^>]*>)(.*?)(</select>)',
            rf'\1<option value="{p1}" selected>{p1}</option>\3',
            html,
            count=1,
            flags=re.S,
        )
        html = re.sub(
            r'(<select id="p2"[^>]*>)(.*?)(</select>)',
            rf'\1<option value="{p2}" selected>{p2}</option>\3',
            html,
            count=1,
            flags=re.S,
        )
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
    content = PAGE_WRAPPER_CSS + embed
    r = requests.post(f"{url}/wp-json/wp/v2/pages/{page_id}", auth=auth,
                      json={"content": content}, timeout=60)
    r.raise_for_status()
    n = len(json.loads(re.search(r'id="embedded-data">(.*?)</script>', r.json()["content"]["rendered"], re.S).group(1)))
    print(f"[ok] pushed to WordPress page {page_id}: {n} players live")


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild the public matchup simulator.")
    parser.add_argument("--workbook", default=os.path.join(REPO_DIR, "workbooks", "PGA_stat_caddy_latest.xlsx"))
    parser.add_argument("--push", action="store_true", help="Also update the live WordPress page.")
    args = parser.parse_args()

    players = build_players(args.workbook)
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
