#!/usr/bin/env python3
"""
Field stats for the current event, read from the CSV snapshots in datagolf/data/.

Joins the field list (`dg_field.csv`) to Data Golf's skill ratings, pre-tournament
probabilities and rankings on `dg_id`, then reports who is in the field, how strong
it is, and where the strokes-gained strength sits. Read-only: it never calls the
Data Golf API, so run `update_csv.py` first if the snapshots are stale.

Driving distance and accuracy come from Data Golf's skill ratings on their native
scale: a deviation from the tour average (yards, and fraction of fairways hit),
not the raw per-round number.

Usage:
    python datagolf/field_stats.py
    python datagolf/field_stats.py --top 20
    python datagolf/field_stats.py --json
    python datagolf/field_stats.py --export-csv field_stats.csv --chart field_stats.png
    python datagolf/field_stats.py --export-xlsx field_stats.xlsx
"""

import argparse
import ast
import datetime
import json
import math
import os
import sys

import pandas as pd

MONTH_NAMES = ("January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December")
# Data Golf's schedule start_date is round one (a Thursday); the final round is three days later.
DAYS_TO_FINAL_ROUND = 3

TOUR_NAMES = {"pga": "PGA Tour", "euro": "DP World Tour", "kft": "Korn Ferry Tour",
              "alt": "Alternative tours", "liv": "LIV Golf"}

# Skill-rating columns to summarise, in the order the report shows them.
SKILL_METRICS = (
    ("sg_total", "SG: Total"),
    ("sg_ott", "SG: Off the tee"),
    ("sg_app", "SG: Approach"),
    ("sg_arg", "SG: Around green"),
    ("sg_putt", "SG: Putting"),
    ("driving_dist", "Driving dist (yds)"),
    ("driving_acc", "Driving accuracy"),
)
# The strokes-gained components, for the per-category leaderboards.
SG_COMPONENTS = ("sg_total", "sg_ott", "sg_app", "sg_arg", "sg_putt")
PROBABILITIES = (("win", "Win"), ("top_5", "Top 5"), ("top_10", "Top 10"), ("top_20", "Top 20"))
RANK_BUCKETS = (10, 25, 50, 100)

WIDTH = 78


class FieldStatsError(Exception):
    pass


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------


def read_snapshot(data_dir: str, filename: str, required: bool = True) -> pd.DataFrame:
    path = os.path.join(data_dir, filename)
    if not os.path.exists(path):
        if required:
            raise FieldStatsError(f"missing snapshot {path} (run update_csv.py first)")
        return pd.DataFrame()
    return pd.read_csv(path)


def display_name(name: str) -> str:
    """Data Golf ships "Last, First"; the report reads better as "First Last"."""
    text = str(name).strip()
    if "," not in text:
        return text
    last, first = [part.strip() for part in text.split(",", 1)]
    return f"{first} {last}".strip()


def build_field(data_dir: str) -> tuple:
    """Return (field DataFrame, all-players skill ratings, event context dict)."""
    field = read_snapshot(data_dir, "dg_field.csv")
    if field.empty:
        raise FieldStatsError("dg_field.csv has no rows: no event is currently open")
    for column in ("dg_id", "player_name"):
        if column not in field.columns:
            raise FieldStatsError(f"dg_field.csv is missing the {column} column")

    skills = read_snapshot(data_dir, "dg_skill_ratings.csv")
    predictions = read_snapshot(data_dir, "dg_predictions.csv", required=False)
    schedule = read_snapshot(data_dir, "dg_schedule.csv", required=False)

    event_name = str(field["event_name"].dropna().iloc[0]) if "event_name" in field else "Unknown event"
    merged = field.drop(columns=["event_name"], errors="ignore")
    merged["player"] = merged["player_name"].map(display_name)

    if not skills.empty:
        skill_columns = ["dg_id"] + [name for name, _ in SKILL_METRICS if name in skills.columns]
        merged = merged.merge(skills[skill_columns], on="dg_id", how="left")
    if not predictions.empty:
        probability_columns = ["dg_id"] + [name for name, _ in PROBABILITIES if name in predictions.columns]
        merged = merged.merge(predictions[probability_columns], on="dg_id", how="left")

    context = {
        "event_name": event_name,
        "field_size": int(len(merged)),
        "snapshot": str(field["updated_at"].dropna().iloc[0]) if "updated_at" in field else None,
        "rated_players": int(len(skills)),
    }
    context.update(event_context(schedule, event_name))
    return merged, skills, context


def event_context(schedule: pd.DataFrame, event_name: str) -> dict:
    """Course, location and date range for the event, from the schedule snapshot."""
    if schedule.empty or "event_name" not in schedule.columns:
        return {}
    rows = schedule[schedule["event_name"].astype(str).str.casefold() == event_name.casefold()]
    if rows.empty:
        return {}
    row = rows.iloc[0]
    return {
        "course": none_if_missing(row.get("course")),
        "location": none_if_missing(row.get("location")),
        "tour": TOUR_NAMES.get(str(row.get("tour")), none_if_missing(row.get("tour"))),
        "dates": format_event_dates(row.get("start_date")),
    }


def none_if_missing(value):
    return None if value is None or pd.isna(value) else str(value)


def format_event_dates(start_date) -> str:
    """Round one through the final round, e.g. 'August 20-23, 2026'."""
    if start_date is None or pd.isna(start_date):
        return None
    try:
        start = datetime.date.fromisoformat(str(start_date))
    except ValueError:
        return None
    end = start + datetime.timedelta(days=DAYS_TO_FINAL_ROUND)
    if start.month == end.month:
        return f"{MONTH_NAMES[start.month - 1]} {start.day}-{end.day}, {end.year}"
    return (f"{MONTH_NAMES[start.month - 1]} {start.day} - "
            f"{MONTH_NAMES[end.month - 1]} {end.day}, {end.year}")


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


def summarise_metric(field: pd.DataFrame, column: str) -> dict:
    values = pd.to_numeric(field.get(column), errors="coerce").dropna() if column in field else pd.Series(dtype=float)
    if values.empty:
        return {}
    leader_index = values.idxmax()
    trailer_index = values.idxmin()
    return {
        "count": int(len(values)),
        "mean": float(values.mean()),
        "median": float(values.median()),
        "stdev": float(values.std()) if len(values) > 1 else 0.0,
        "min": float(values.min()),
        "max": float(values.max()),
        "leader": field.at[leader_index, "player"],
        "trailer": field.at[trailer_index, "player"],
    }


def rank_summary(field: pd.DataFrame, column: str) -> dict:
    values = pd.to_numeric(field.get(column), errors="coerce").dropna() if column in field else pd.Series(dtype=float)
    if values.empty:
        return {}
    return {
        "best": int(values.min()),
        "median": float(values.median()),
        "worst": int(values.max()),
        "buckets": {f"top_{bucket}": int((values <= bucket).sum()) for bucket in RANK_BUCKETS},
    }


def field_strength(field: pd.DataFrame, skills: pd.DataFrame) -> dict:
    """The field's SG: Total mean against every player Data Golf rates."""
    field_values = pd.to_numeric(field.get("sg_total"), errors="coerce").dropna()
    tour_values = pd.to_numeric(skills.get("sg_total"), errors="coerce").dropna() if not skills.empty else pd.Series(dtype=float)
    if field_values.empty or tour_values.empty:
        return {}
    field_mean = float(field_values.mean())
    return {
        "field_mean": field_mean,
        "rated_mean": float(tour_values.mean()),
        "percentile": float((tour_values < field_mean).mean() * 100),
        "unrated": int(len(field) - len(field_values)),
    }


def tee_time_windows(field: pd.DataFrame) -> list:
    """Per-round tee window and wave split, parsed from the field's teetimes column."""
    if "teetimes" not in field.columns:
        return []
    rounds = {}
    for raw in field["teetimes"].dropna():
        try:
            entries = ast.literal_eval(str(raw))
        except (ValueError, SyntaxError):
            continue
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict) or not entry.get("teetime"):
                continue
            bucket = rounds.setdefault(entry.get("round_num"), {"times": [], "waves": {}})
            bucket["times"].append(str(entry["teetime"]))
            wave = str(entry.get("wave") or "unknown")
            bucket["waves"][wave] = bucket["waves"].get(wave, 0) + 1
    summary = []
    for round_num in sorted(rounds, key=lambda value: (value is None, value)):
        times = sorted(rounds[round_num]["times"])
        summary.append({
            "round": round_num,
            "players": len(times),
            "first": times[0],
            "last": times[-1],
            "waves": rounds[round_num]["waves"],
        })
    return summary


def win_concentration(field: pd.DataFrame, head: int = 5) -> dict:
    """How top-heavy the field is: the share of win probability held by the favourites."""
    values = pd.to_numeric(field.get("win"), errors="coerce").dropna() if "win" in field else pd.Series(dtype=float)
    total = float(values.sum())
    if values.empty or total <= 0:
        return {}
    return {"head": head, "share": float(values.nlargest(head).sum()) / total}


def leaderboard(field: pd.DataFrame, column: str, top: int, ascending: bool = False) -> list:
    if column not in field.columns:
        return []
    frame = field.dropna(subset=[column]).sort_values(column, ascending=ascending)
    return [{"player": row["player"], "value": float(row[column])} for _, row in frame.head(top).iterrows()]


def collect_stats(field: pd.DataFrame, skills: pd.DataFrame, context: dict, top: int) -> dict:
    countries = (field["country"].fillna("unknown").value_counts().to_dict()
                 if "country" in field.columns else {})
    amateurs = int(pd.to_numeric(field.get("am"), errors="coerce").fillna(0).sum()) if "am" in field else 0
    return {
        "event": context,
        "composition": {
            "countries": countries,
            "country_count": len(countries),
            "amateurs": amateurs,
            "dg_rank": rank_summary(field, "dg_rank"),
            "owgr_rank": rank_summary(field, "owgr_rank"),
        },
        "strength": field_strength(field, skills),
        "metrics": {column: summarise_metric(field, column) for column, _ in SKILL_METRICS},
        "sg_leaders": {column: leaderboard(field, column, top) for column in SG_COMPONENTS},
        "probabilities": {
            column: {"leaders": leaderboard(field, column, top),
                     **summarise_metric(field, column)}
            for column, _ in PROBABILITIES if column in field.columns
        },
        "win_concentration": win_concentration(field),
        "tee_times": tee_time_windows(field),
    }


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def signed(value, decimals: int = 3) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "n/a"
    return f"{value:+.{decimals}f}"


def percent(value) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "n/a"
    return f"{value * 100:.1f}%"


def heading(title: str) -> list:
    return ["", title.upper(), "-" * WIDTH]


def render(stats: dict, top: int) -> str:
    event = stats["event"]
    composition = stats["composition"]
    lines = ["=" * WIDTH, f"FIELD STATS — {event.get('event_name')}", "=" * WIDTH]
    for label, value in (
        ("Tour", event.get("tour")),
        ("Course", ", ".join(part for part in (event.get("course"), event.get("location")) if part) or None),
        ("Dates", event.get("dates")),
        ("Field size", f"{event.get('field_size')} players"
                       + (f" ({composition['amateurs']} amateur)" if composition["amateurs"] else "")),
        ("Snapshot", event.get("snapshot")),
    ):
        if value:
            lines.append(f"  {label:<12}{value}")

    lines += heading("Composition")
    countries = composition["countries"]
    top_countries = ", ".join(f"{code} {count}" for code, count in list(countries.items())[:8])
    lines.append(f"  Countries     {composition['country_count']} represented — {top_countries}")
    for label, key in (("DG rank", "dg_rank"), ("OWGR rank", "owgr_rank")):
        summary = composition[key]
        if not summary:
            continue
        buckets = "  ".join(f"top-{bucket}: {summary['buckets'][f'top_{bucket}']}" for bucket in RANK_BUCKETS)
        lines.append(f"  {label:<12}  best {summary['best']}, median {summary['median']:g}, "
                     f"worst {summary['worst']}")
        lines.append(f"  {'':<12}  {buckets}")

    strength = stats["strength"]
    if strength:
        lines += heading("Field strength (SG: Total per round, Data Golf skill ratings)")
        lines.append(f"  Field average       {signed(strength['field_mean'])} "
                     f"vs {signed(strength['rated_mean'])} across all "
                     f"{event.get('rated_players')} rated players")
        lines.append(f"  Field average sits in the {strength['percentile']:.1f}th percentile of rated players")
        if strength["unrated"]:
            lines.append(f"  {strength['unrated']} field player(s) have no skill rating and are excluded")

    lines += heading("Skill distribution")
    lines.append(f"  {'Metric':<20}{'mean':>8}{'median':>9}{'stdev':>8}{'min':>9}{'max':>9}   leader")
    for column, label in SKILL_METRICS:
        summary = stats["metrics"].get(column)
        if not summary:
            continue
        lines.append(f"  {label:<20}{signed(summary['mean']):>8}{signed(summary['median']):>9}"
                     f"{summary['stdev']:>8.3f}{signed(summary['min']):>9}{signed(summary['max']):>9}"
                     f"   {summary['leader']}")

    lines += heading(f"Category leaders (top {top})")
    for column in SG_COMPONENTS:
        leaders = stats["sg_leaders"].get(column) or []
        if not leaders:
            continue
        label = dict(SKILL_METRICS)[column]
        entries = ", ".join(f"{entry['player']} {signed(entry['value'])}" for entry in leaders)
        lines.append(f"  {label}")
        for chunk in wrap_entries(entries):
            lines.append(f"    {chunk}")

    probabilities = stats["probabilities"]
    if probabilities:
        lines += heading(f"Pre-tournament probabilities (top {top} by win)")
        win_leaders = probabilities.get("win", {}).get("leaders") or []
        for position, entry in enumerate(win_leaders, start=1):
            lines.append(f"  {position:>2}. {entry['player']:<24}{percent(entry['value']):>8}")
        for column, label in PROBABILITIES:
            summary = probabilities.get(column)
            if not summary or "mean" not in summary:
                continue
            lines.append(f"  {label:<8} favourite {summary['leader']} at {percent(summary['max'])}, "
                         f"field average {percent(summary['mean'])}")
        concentration = stats["win_concentration"]
        if concentration:
            lines.append(f"  The {concentration['head']} favourites hold "
                         f"{percent(concentration['share'])} of the win probability")

    tee_times = stats["tee_times"]
    if tee_times:
        lines += heading("Tee times")
        for entry in tee_times:
            waves = ", ".join(f"{wave} {count}" for wave, count in sorted(entry["waves"].items()))
            lines.append(f"  Round {entry['round']}   {entry['players']} players   "
                         f"{entry['first']} → {entry['last']}   ({waves})")

    lines.append("")
    return "\n".join(lines)


def wrap_entries(text: str, width: int = WIDTH - 6) -> list:
    """Wrap a comma-separated list without splitting an entry across lines."""
    chunks, current = [], ""
    for entry in text.split(", "):
        candidate = f"{current}, {entry}" if current else entry
        if len(candidate) > width and current:
            chunks.append(current)
            current = entry
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def write_chart(field: pd.DataFrame, stats: dict, path: str, top: int) -> None:
    """A two-panel PNG: SG: Total across the field, and the win-probability leaders."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    ranked = field.dropna(subset=["sg_total"]).sort_values("sg_total", ascending=False)
    figure, (left, right) = plt.subplots(1, 2, figsize=(14, 7))

    left.barh(ranked["player"][::-1], ranked["sg_total"][::-1], color="#2b6cb0")
    left.axvline(stats["strength"].get("field_mean", 0), color="#c53030", linestyle="--",
                 label=f"field mean {signed(stats['strength'].get('field_mean'))}")
    left.set_title(f"{stats['event'].get('event_name')} — SG: Total by player")
    left.set_xlabel("Strokes gained per round")
    left.tick_params(axis="y", labelsize=6)
    left.legend(loc="lower right")

    win_leaders = stats["probabilities"].get("win", {}).get("leaders") or []
    if win_leaders:
        names = [entry["player"] for entry in win_leaders][::-1]
        values = [entry["value"] * 100 for entry in win_leaders][::-1]
        right.barh(names, values, color="#2f855a")
        for index, value in enumerate(values):
            right.text(value + 0.2, index, f"{value:.1f}%", va="center", fontsize=8)
        right.set_title(f"Win probability — top {len(win_leaders)}")
        right.set_xlabel("Percent")
        right.set_xlim(0, max(values) * 1.2)

    figure.suptitle(f"Field stats — snapshot {stats['event'].get('snapshot')}", fontsize=10)
    figure.tight_layout()
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    figure.savefig(path, dpi=130)
    plt.close(figure)


def export_columns(field: pd.DataFrame) -> pd.DataFrame:
    """The merged per-player table, best first. Probabilities are Data Golf's raw
    fractions carried to more than a dozen decimals; four is past the model's
    resolution already, and it keeps the file readable in a spreadsheet."""
    wanted = (["player", "country", "dg_rank", "owgr_rank", "tour_rank"]
              + [column for column, _ in SKILL_METRICS]
              + [column for column, _ in PROBABILITIES])
    columns = [column for column in wanted if column in field.columns]
    sort_column = "sg_total" if "sg_total" in columns else columns[0]
    exported = field[columns].sort_values(sort_column, ascending=False)
    rounded = [column for column, _ in PROBABILITIES if column in columns]
    return exported.assign(**{column: exported[column].round(4) for column in rounded})


def write_workbook(table: pd.DataFrame, path: str, sheet_name: str = "Field Stats") -> None:
    """The same table as a spreadsheet, with the header frozen and columns sized to fit."""
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        table.to_excel(writer, sheet_name=sheet_name[:31], index=False)
        sheet = writer.sheets[sheet_name[:31]]
        sheet.freeze_panes = "A2"
        for index, column in enumerate(table.columns, start=1):
            widest = max([len(str(column))] + [len(str(value)) for value in table[column]])
            sheet.column_dimensions[sheet.cell(row=1, column=index).column_letter].width = widest + 2


def main() -> int:
    parser = argparse.ArgumentParser(description="Report stats for the current event's field.")
    parser.add_argument("--data-dir", default=os.path.join(os.path.dirname(__file__), "data"),
                        help="Directory holding the dg_*.csv snapshots")
    parser.add_argument("--top", type=int, default=10, help="Rows per leaderboard (default: 10)")
    parser.add_argument("--json", action="store_true", help="Emit the stats as JSON instead of a report")
    parser.add_argument("--export-csv", help="Also write the merged per-player table to this path")
    parser.add_argument("--export-xlsx", help="Also write the merged per-player table as a spreadsheet")
    parser.add_argument("--chart", help="Also write a PNG summary chart to this path")
    args = parser.parse_args()

    try:
        field, skills, context = build_field(args.data_dir)
    except FieldStatsError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 2

    stats = collect_stats(field, skills, context, args.top)
    print(json.dumps(stats, indent=2, default=str) if args.json else render(stats, args.top))

    if args.export_csv:
        export_columns(field).to_csv(args.export_csv, index=False)
        print(f"[ok] wrote per-player table -> {args.export_csv}", file=sys.stderr)
    if args.export_xlsx:
        write_workbook(export_columns(field), args.export_xlsx,
                       f"{context.get('event_name', 'Field')} Stats")
        print(f"[ok] wrote spreadsheet -> {args.export_xlsx}", file=sys.stderr)
    if args.chart:
        write_chart(field, stats, args.chart, args.top)
        print(f"[ok] wrote chart -> {args.chart}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
