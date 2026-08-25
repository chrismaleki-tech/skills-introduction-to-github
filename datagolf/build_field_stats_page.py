#!/usr/bin/env python3
"""
Build the Field Stats page for the current event (this week: the TOUR Championship).

Read-only over the CSV snapshots already committed in datagolf/data/ — no API calls,
update_csv.py stays the only thing that talks to Data Golf. The current field
(dg_field.csv) is joined to skill ratings (dg_skill_ratings.csv, on dg_id), the
schedule (dg_schedule.csv, for course/location/dates), and the week's StatCaddy
field sheet (workbooks/StatCaddy_Field_latest.csv, for Course Fit / Form / History /
Points). Pre-tournament win probabilities are included only when dg_predictions.csv
was snapshotted for the same event; a stale predictions file is skipped, not shown.

Outputs (all self-contained, no external assets):
    field_stats/statcaddy-field-stats.html   standalone page (open in any browser)
    field_stats/wp-embed.html                WordPress-safe embed (scoped CSS + base64 JS)
    field_stats/players.json                 the merged per-player table

Env (only needed for the push step):
    WP_URL, WP_USERNAME, WP_APP_PASSWORD, WP_FIELD_STATS_PAGE_ID

Usage:
    python datagolf/build_field_stats_page.py
    python datagolf/build_field_stats_page.py --push   # also update the live page
"""

import argparse
import base64
import csv
import html
import json
import os
import re
import sys

from deploy_simulator import format_event_dates, norm_name

REPO_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(REPO_DIR, "data")
FIELD_SHEET = os.path.join(REPO_DIR, "workbooks", "StatCaddy_Field_latest.csv")
OUT_DIR = os.path.join(os.path.dirname(REPO_DIR), "field_stats")

# Data Golf skill-ratings column -> table key (all strokes gained vs. the field,
# except driving distance/accuracy which Data Golf reports vs. tour baseline).
SKILL_COLS = {"sg_total": "total", "sg_ott": "ott", "sg_app": "app",
              "sg_arg": "arg", "sg_putt": "putt",
              "driving_dist": "dist", "driving_acc": "acc"}
# StatCaddy field-sheet column -> table key.
SHEET_COLS = {"T2Green": "fit", "Form": "form", "History": "hist", "Points": "pts"}


def read_csv(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def display_name(dg_name):
    """Data Golf's 'Aberg, Ludvig' -> 'Ludvig Aberg'."""
    if "," in dg_name:
        last, first = [p.strip() for p in dg_name.split(",", 1)]
        return f"{first} {last}"
    return dg_name.strip()


def _num(value, digits=3):
    try:
        v = round(float(value), digits)
        return int(v) if digits == 0 else v
    except (TypeError, ValueError):
        return None


def load_event(data_dir):
    """Event context for the field snapshot: name, course, location, date label."""
    field = read_csv(os.path.join(data_dir, "dg_field.csv"))
    if not field:
        raise SystemExit("dg_field.csv is empty — no event is upcoming or in progress.")
    event = field[0]["event_name"]
    ctx = {"event": event, "course": None, "location": None, "dates": None,
           "snapshot": max((r.get("updated_at") or "" for r in field), default="")[:10]}
    for row in read_csv(os.path.join(data_dir, "dg_schedule.csv")):
        if norm_name(row.get("event_name") or "") == norm_name(event):
            ctx["course"] = row.get("course")
            ctx["location"] = row.get("location")
            if row.get("start_date"):
                ctx["dates"] = format_event_dates(row["start_date"])
                ctx["year"] = row["start_date"][:4]
            break
    return ctx, field


def load_players(data_dir=DATA_DIR, sheet_path=FIELD_SHEET):
    """Return (event_ctx, players): one merged record per field player.

    Players Data Golf cannot rate keep None for the skill columns rather than a
    fabricated zero; the page renders those as em dashes and sorts them last.
    """
    ctx, field = load_event(data_dir)
    skill = {r["dg_id"]: r for r in read_csv(os.path.join(data_dir, "dg_skill_ratings.csv"))}

    sheet = {}
    if os.path.exists(sheet_path):
        rows = read_csv(sheet_path)
        # The sheet is only authoritative when it was built for this same event.
        if rows and norm_name(rows[0].get("Tournament") or "") == norm_name(ctx["event"]):
            sheet = {norm_name(r["Player"]): r for r in rows}

    preds = {}
    pred_rows = read_csv(os.path.join(data_dir, "dg_predictions.csv"))
    if pred_rows and norm_name(pred_rows[0].get("event_name") or "") == norm_name(ctx["event"]):
        preds = {r["dg_id"]: r for r in pred_rows}
    ctx["has_odds"] = bool(preds)

    players = []
    for row in field:
        rec = {
            "name": display_name(row["player_name"]),
            "country": row.get("country") or "",
            "dg_rank": _num(row.get("dg_rank"), 0),
            "owgr": _num(row.get("owgr_rank"), 0),
        }
        sk = skill.get(row["dg_id"], {})
        for col, key in SKILL_COLS.items():
            rec[key] = _num(sk.get(col))
        sh = sheet.get(norm_name(row["player_name"]), {})
        for col, key in SHEET_COLS.items():
            rec[key] = _num(sh.get(col))
        pr = preds.get(row["dg_id"], {})
        if preds:
            rec["win"] = _num(pr.get("win"), 4)
            rec["top5"] = _num(pr.get("top_5"), 4)
            rec["top10"] = _num(pr.get("top_10"), 4)
        players.append(rec)
    players.sort(key=lambda p: (p["total"] is None, -(p["total"] or 0), p["name"]))
    return ctx, players


def summarize(players):
    rated = [p for p in players if p["total"] is not None]
    cards = [("Field size", f"{len(players)} players", "")]
    if rated:
        avg = sum(p["total"] for p in rated) / len(rated)
        cards.append(("Field avg SG: Total", f"{avg:+.2f}", "per round vs. all rated players"))
        best = max(rated, key=lambda p: p["total"])
        cards.append(("Highest rated", best["name"], f"{best['total']:+.2f} SG: Total"))
    fits = [p for p in players if p["fit"] is not None]
    if fits:
        bf = max(fits, key=lambda p: p["fit"])
        cards.append(("Best course fit", bf["name"], f"{bf['fit']:+.2f} T2Green"))
    return cards


# ── rendering ─────────────────────────────────────────────────────────────────

CSS = """
  :root {
    --green: #1b4332; --green-2: #2d6a4f; --fairway: #40916c; --light: #d8f3dc;
    --bg: #f6f8f6; --card: #ffffff; --ink: #1b2a24; --muted: #6b7f76; --accent: #b7791f;
  }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: "Segoe UI", system-ui, sans-serif; background: var(--bg); color: var(--ink); padding: 24px 16px; }
  .wrap { max-width: 1080px; margin: 0 auto; }
  h1 { color: var(--green); font-size: 1.5rem; }
  .sub { color: var(--muted); margin: 4px 0 18px; font-size: .95rem; }
  .sub b { color: var(--green-2); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px; }
  .kcard { background: var(--card); border-radius: 14px; box-shadow: 0 2px 10px rgba(27,67,50,.08); padding: 14px 16px; }
  .kcard .k { font-size: .72rem; font-weight: 700; color: var(--green-2); text-transform: uppercase; letter-spacing: .05em; }
  .kcard .v { font-size: 1.25rem; font-weight: 800; color: var(--green); margin-top: 2px; }
  .kcard .d { font-size: .78rem; color: var(--muted); margin-top: 1px; }
  .card { background: var(--card); border-radius: 14px; box-shadow: 0 2px 10px rgba(27,67,50,.08); padding: 8px 4px 4px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: .86rem; min-width: 900px; }
  th, td { padding: 7px 9px; text-align: right; border-bottom: 1px solid #eef4f0; font-variant-numeric: tabular-nums; white-space: nowrap; }
  th { color: var(--muted); font-weight: 600; font-size: .72rem; text-transform: uppercase; letter-spacing: .03em;
       cursor: pointer; user-select: none; position: sticky; top: 0; background: var(--card); }
  th:hover { color: var(--green-2); }
  th.on { color: var(--green); }
  th .arr { font-size: .6rem; }
  th.pl, td.pl { text-align: left; }
  td.pl { font-weight: 600; }
  td.pl small { color: var(--muted); font-weight: 400; margin-left: 6px; }
  tr:hover td { background: #f2f7f3; }
  td.pos { color: var(--fairway); font-weight: 600; } td.neg { color: #b3261e; }
  td .bar { display: inline-block; vertical-align: middle; height: 8px; border-radius: 999px;
            background: linear-gradient(90deg, var(--green-2), var(--fairway)); margin-right: 7px; }
  .foot { color: var(--muted); font-size: .8rem; margin-top: 10px; }
"""

JS = r"""
(function () {
  var root = document.getElementById("sc-field");
  var players = JSON.parse(root.querySelector("#field-data").textContent);
  var hasOdds = players.length && players[0].win !== undefined;
  var cols = [
    { key: "name", label: "Player", num: false },
    { key: "dg_rank", label: "DG Rank", num: true, asc: true, plain: true },
    { key: "owgr", label: "OWGR", num: true, asc: true, plain: true },
    { key: "total", label: "SG: Total", num: true, bar: true },
    { key: "ott", label: "OTT", num: true },
    { key: "app", label: "APP", num: true },
    { key: "arg", label: "ARG", num: true },
    { key: "putt", label: "PUTT", num: true },
    { key: "dist", label: "Dist", num: true },
    { key: "acc", label: "Acc", num: true },
    { key: "fit", label: "Course Fit", num: true },
    { key: "form", label: "Form", num: true },
    { key: "hist", label: "History", num: true },
    { key: "pts", label: "Points", num: true, plain: true }
  ];
  if (hasOdds) cols.push({ key: "win", label: "Win %", num: true, pct: true, plain: true },
                         { key: "top5", label: "Top 5 %", num: true, pct: true, plain: true });
  var sortKey = "total", sortAsc = false;

  var maxTotal = 0;
  players.forEach(function (p) { if (p.total != null) maxTotal = Math.max(maxTotal, Math.abs(p.total)); });

  function fmt(c, v) {
    if (v == null) return "\u2014";
    if (c.pct) return (100 * v).toFixed(1) + "%";
    if (c.plain) return c.asc ? String(v) : v.toFixed(2);
    return (v >= 0 ? "+" : "") + v.toFixed(2);
  }
  function render() {
    var thead = "<tr>" + cols.map(function (c) {
      var on = c.key === sortKey;
      return '<th class="' + (c.num ? "" : "pl ") + (on ? "on" : "") + '" data-k="' + c.key + '">' +
        c.label + (on ? ' <span class="arr">' + (sortAsc ? "\u25b2" : "\u25bc") + "</span>" : "") + "</th>";
    }).join("") + "</tr>";
    var sorted = players.slice().sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      if (x == null && y == null) return a.name < b.name ? -1 : 1;
      if (x == null) return 1;                       // blanks always sort last
      if (y == null) return -1;
      if (x === y) return a.name < b.name ? -1 : 1;
      return (x < y ? -1 : 1) * (sortAsc ? 1 : -1);
    });
    var rows = sorted.map(function (p, i) {
      return "<tr>" + cols.map(function (c) {
        var v = p[c.key];
        if (!c.num) return '<td class="pl">' + (i + 1) + ". " + p.name + "<small>" + p.country + "</small></td>";
        var cls = (!c.plain && v != null) ? (v >= 0 ? "pos" : "neg") : "";
        var bar = "";
        if (c.bar && v != null && maxTotal > 0)
          bar = '<span class="bar" style="width:' + Math.round(40 * Math.abs(v) / maxTotal) + 'px"></span>';
        return '<td class="' + cls + '">' + bar + fmt(c, v) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    root.querySelector("table").innerHTML = "<thead>" + thead + "</thead><tbody>" + rows + "</tbody>";
    root.querySelectorAll("th").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.getAttribute("data-k");
        var col = cols.filter(function (c) { return c.key === k; })[0];
        if (sortKey === k) { sortAsc = !sortAsc; }
        else { sortKey = k; sortAsc = col.num ? !!col.asc : true; }
        render();
      });
    });
  }
  render();
})();
"""


def render_body(ctx, players):
    """The page body markup (shared by the standalone page and the WP embed)."""
    cards = "".join(
        f'<div class="kcard"><div class="k">{html.escape(k)}</div>'
        f'<div class="v">{html.escape(v)}</div>'
        + (f'<div class="d">{html.escape(d)}</div>' if d else "") + "</div>"
        for k, v, d in summarize(players))
    sub = " · ".join(html.escape(s) for s in
                     [ctx.get("course"), ctx.get("location"),
                      f"{ctx.get('dates')}, {ctx.get('year')}" if ctx.get("dates") else None] if s)
    odds_note = ("" if ctx.get("has_odds") else
                 " Win probabilities are omitted: the predictions snapshot is for an earlier event.")
    return (
        f'<div class="wrap">'
        f'<h1>{html.escape(ctx["event"])} — Field Stats</h1>'
        f'<div class="sub"><b>{sub}</b></div>'
        f'<div class="cards">{cards}</div>'
        f'<div class="card"><table></table></div>'
        f'<div class="foot">Strokes-gained columns are per-round skill vs. the field; '
        f'Dist/Acc vs. tour baseline (Data Golf). Course Fit (T2Green), Form, History and Points '
        f'are StatCaddy model inputs. Click a column to sort. '
        f'Snapshot: {html.escape(ctx["snapshot"])}.{odds_note}</div>'
        f'</div>')


def render_page(ctx, players):
    data = json.dumps(players, separators=(",", ":"))
    return (
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        f"<title>StatCaddy — {html.escape(ctx['event'])} Field Stats</title>\n"
        f"<style>{CSS}</style>\n</head>\n<body>\n"
        f"<div id=\"sc-field\">{render_body(ctx, players)}"
        f"<script type=\"application/json\" id=\"field-data\">{data}</script></div>\n"
        f"<script>{JS}</script>\n</body>\n</html>\n")


def build_embed(ctx, players):
    """A WordPress-safe block: scoped CSS + inline JSON + base64 JS, one <div>."""
    style = re.sub(r"\s+", " ", CSS.replace("body {", "#sc-field {")).strip()
    data = json.dumps(players, separators=(",", ":"))
    return (
        f'<div id="sc-field"><style>{style}</style>{render_body(ctx, players)}'
        f'<script type="application/json" id="field-data">{data}</script>'
        f'<script>eval(atob("{base64.b64encode(JS.encode()).decode()}"));</script></div>')


def push_to_wordpress(embed):
    import requests
    url = os.environ["WP_URL"].rstrip("/")
    page_id = os.environ["WP_FIELD_STATS_PAGE_ID"]
    auth = (os.environ["WP_USERNAME"], os.environ["WP_APP_PASSWORD"].replace(" ", ""))
    r = requests.post(f"{url}/wp-json/wp/v2/pages/{page_id}", auth=auth,
                      json={"content": embed}, timeout=60)
    r.raise_for_status()
    print(f"[ok] pushed field stats to WordPress page {page_id}")


def main():
    parser = argparse.ArgumentParser(description="Build the current event's field stats page.")
    parser.add_argument("--data-dir", default=DATA_DIR)
    parser.add_argument("--sheet", default=FIELD_SHEET)
    parser.add_argument("--out-dir", default=OUT_DIR)
    parser.add_argument("--push", action="store_true", help="Also update the live WordPress page.")
    args = parser.parse_args()

    ctx, players = load_players(args.data_dir, args.sheet)
    rated = sum(1 for p in players if p["total"] is not None)
    os.makedirs(args.out_dir, exist_ok=True)
    open(os.path.join(args.out_dir, "statcaddy-field-stats.html"), "w").write(render_page(ctx, players))
    embed = build_embed(ctx, players)
    open(os.path.join(args.out_dir, "wp-embed.html"), "w").write(embed)
    json.dump(players, open(os.path.join(args.out_dir, "players.json"), "w"), indent=0)
    print(f"[ok] {ctx['event']} ({ctx.get('dates')}): {len(players)} players "
          f"({rated} rated) -> {args.out_dir}")

    if args.push:
        required = ("WP_URL", "WP_USERNAME", "WP_APP_PASSWORD", "WP_FIELD_STATS_PAGE_ID")
        if not all(os.environ.get(v) for v in required):
            print(f"ERROR: --push requires {' / '.join(required)}", file=sys.stderr)
            return 2
        push_to_wordpress(embed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
