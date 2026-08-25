"""The Field Stats page built from the week's CSV snapshots.

build_field_stats_page.py joins dg_field.csv to the skill ratings, schedule and the
StatCaddy field sheet and renders one self-contained page. These tests pin the joins
(stale sheets and stale predictions must be dropped, unrated players must not gain
fabricated zeros) and the rendered artefacts, then run the real committed snapshots
through the builder so a snapshot that stops joining fails loudly.
"""

import csv
import json
import re
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "datagolf"))

import build_field_stats_page as bfs  # noqa: E402

DATA = REPO / "datagolf" / "data"
SHEET = REPO / "datagolf" / "workbooks" / "StatCaddy_Field_latest.csv"


def write_csv(path, header, rows):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


@pytest.fixture
def snapshots(tmp_path):
    """A tiny synthetic week: two rated players, one Data Golf cannot rate."""
    write_csv(tmp_path / "dg_field.csv",
              ["event_name", "am", "country", "dg_id", "dg_rank", "owgr_rank",
               "player_name", "updated_at"],
              [["Test Invitational", 0, "USA", 1, 1, 2, "Alpha, Aaron", "2026-08-24T10:00:00+00:00"],
               ["Test Invitational", 0, "SWE", 2, 9, 8, "Beta, Bo", "2026-08-24T10:00:00+00:00"],
               ["Test Invitational", 1, "ENG", 3, "", "", "Gamma, Gus", "2026-08-24T10:00:00+00:00"]])
    write_csv(tmp_path / "dg_skill_ratings.csv",
              ["dg_id", "driving_acc", "driving_dist", "player_name", "sg_app",
               "sg_arg", "sg_ott", "sg_putt", "sg_total", "updated_at"],
              [[1, 0.05, 7.0, "Alpha, Aaron", 1.0, 0.3, 0.8, 0.6, 2.7, ""],
               [2, -0.01, 2.0, "Beta, Bo", 0.4, 0.1, 0.5, 0.2, 1.2, ""]])
    write_csv(tmp_path / "dg_schedule.csv",
              ["event_name", "course", "location", "start_date", "tour"],
              [["Test Invitational", "Test National GC", "Testville, TS", "2026-08-27", "pga"]])
    write_csv(tmp_path / "dg_predictions.csv",
              ["event_name", "dg_id", "player_name", "win", "top_5", "top_10"],
              [["Test Invitational", 1, "Alpha, Aaron", 0.25123456, 0.5, 0.7],
               ["Test Invitational", 2, "Beta, Bo", 0.05, 0.2, 0.4]])
    write_csv(tmp_path / "sheet.csv",
              ["Player", "SG OTT", "Points", "Approach", "Putting", "Around Green",
               "T2Green", "Form", "History", "Tournament", "Tour"],
              [["Aaron Alpha", 0.8, 4.5, 1.0, 0.6, 0.3, 0.02, 3.1, -0.04, "Test Invitational", "PGA Tour"],
               ["Bo Beta", 0.5, 1.2, 0.4, 0.2, 0.1, -0.03, 0.9, 0.01, "Test Invitational", "PGA Tour"]])
    return tmp_path


def load(snapshots, sheet="sheet.csv"):
    return bfs.load_players(str(snapshots), str(snapshots / sheet))


# ── the joins ─────────────────────────────────────────────────────────────────

def test_every_field_player_appears_once(snapshots):
    _, players = load(snapshots)
    assert [p["name"] for p in players] == ["Aaron Alpha", "Bo Beta", "Gus Gamma"]


def test_names_are_first_last(snapshots):
    _, players = load(snapshots)
    assert players[0]["name"] == "Aaron Alpha"  # from Data Golf's "Alpha, Aaron"


def test_skill_ratings_join_on_dg_id(snapshots):
    _, players = load(snapshots)
    alpha = players[0]
    assert (alpha["total"], alpha["ott"], alpha["app"]) == (2.7, 0.8, 1.0)


def test_an_unrated_player_keeps_none_not_zero(snapshots):
    _, players = load(snapshots)
    gus = players[-1]
    assert gus["name"] == "Gus Gamma"
    assert all(gus[k] is None for k in ("total", "ott", "app", "arg", "putt"))


def test_unrated_players_sort_last(snapshots):
    _, players = load(snapshots)
    assert players[-1]["total"] is None
    totals = [p["total"] for p in players[:-1]]
    assert totals == sorted(totals, reverse=True)


def test_the_statcaddy_sheet_joins_by_name(snapshots):
    _, players = load(snapshots)
    assert players[0]["fit"] == 0.02 and players[0]["pts"] == 4.5
    assert players[1]["form"] == 0.9


def test_a_sheet_for_another_event_is_ignored(snapshots):
    rows = list(csv.reader(open(snapshots / "sheet.csv")))
    for r in rows[1:]:
        r[-2] = "Some Other Open"
    write_csv(snapshots / "stale.csv", rows[0], rows[1:])
    _, players = load(snapshots, "stale.csv")
    assert all(p["fit"] is None and p["pts"] is None for p in players)


def test_a_missing_sheet_is_survivable(snapshots):
    _, players = load(snapshots, "nope.csv")
    assert len(players) == 3 and players[0]["total"] == 2.7


def test_matching_predictions_are_included_and_rounded(snapshots):
    ctx, players = load(snapshots)
    assert ctx["has_odds"] is True
    assert players[0]["win"] == 0.2512  # Data Golf ships 8+ decimals; 4 is plenty


def test_stale_predictions_are_dropped(snapshots):
    rows = list(csv.reader(open(snapshots / "dg_predictions.csv")))
    for r in rows[1:]:
        r[0] = "Last Week's Championship"
    write_csv(snapshots / "dg_predictions.csv", rows[0], rows[1:])
    ctx, players = load(snapshots)
    assert ctx["has_odds"] is False
    assert all("win" not in p for p in players)


def test_ranks_are_integers(snapshots):
    _, players = load(snapshots)
    assert players[0]["dg_rank"] == 1 and isinstance(players[0]["dg_rank"], int)
    assert players[-1]["dg_rank"] is None  # blank rank stays blank


# ── event context ─────────────────────────────────────────────────────────────

def test_the_event_context_comes_from_the_schedule(snapshots):
    ctx, _ = load(snapshots)
    assert ctx["event"] == "Test Invitational"
    assert ctx["course"] == "Test National GC"
    assert ctx["location"] == "Testville, TS"


def test_the_date_label_is_thursday_through_sunday(snapshots):
    ctx, _ = load(snapshots)
    assert ctx["dates"] == "August 27-30" and ctx["year"] == "2026"


def test_an_empty_field_exits_with_a_message_not_a_traceback(tmp_path):
    write_csv(tmp_path / "dg_field.csv", ["event_name", "player_name"], [])
    with pytest.raises(SystemExit, match="no event"):
        bfs.load_event(str(tmp_path))


# ── the rendered artefacts ────────────────────────────────────────────────────

def test_the_page_is_self_contained(snapshots):
    ctx, players = load(snapshots)
    page = bfs.render_page(ctx, players)
    assert "http://" not in page and "https://" not in page  # no external assets
    assert "Test Invitational — Field Stats" in page
    assert "August 27-30, 2026" in page


def test_the_page_embeds_the_full_field_as_json(snapshots):
    ctx, players = load(snapshots)
    page = bfs.render_page(ctx, players)
    data = json.loads(re.search(r'id="field-data">(.*?)</script>', page, re.S).group(1))
    assert data == players


def test_the_embed_is_one_scoped_div_with_no_body_styles(snapshots):
    ctx, players = load(snapshots)
    embed = bfs.build_embed(ctx, players)
    assert embed.startswith('<div id="sc-field">') and embed.endswith("</div>")
    assert "body {" not in embed  # CSS is rescoped so it cannot restyle the theme
    assert "eval(atob(" in embed  # JS survives WordPress content filters


def test_the_page_says_when_odds_were_left_out(snapshots):
    rows = list(csv.reader(open(snapshots / "dg_predictions.csv")))
    for r in rows[1:]:
        r[0] = "Last Week's Championship"
    write_csv(snapshots / "dg_predictions.csv", rows[0], rows[1:])
    ctx, players = load(snapshots)
    page = bfs.render_page(ctx, players)
    assert "Win probabilities are omitted" in page


# ── the committed snapshots still join ────────────────────────────────────────

def committed():
    return bfs.load_players(str(DATA), str(SHEET))


def test_the_committed_field_is_a_real_field():
    ctx, players = committed()
    assert len(players) >= 20
    assert ctx["event"] and ctx["course"] and ctx["dates"]


def test_the_committed_field_joins_to_the_skill_ratings():
    _, players = committed()
    rated = [p for p in players if p["total"] is not None]
    assert len(rated) >= 0.8 * len(players)


def test_the_committed_sheet_matches_the_event_or_is_dropped():
    ctx, players = committed()
    with open(SHEET) as f:
        sheet_event = next(csv.DictReader(f))["Tournament"]
    joined = [p for p in players if p["fit"] is not None]
    if bfs.norm_name(sheet_event) == bfs.norm_name(ctx["event"]):
        assert len(joined) >= 0.8 * len(players)
    else:
        assert not joined


def test_the_committed_artifacts_are_current():
    """field_stats/ is committed alongside the snapshots; a drift fails here."""
    out = REPO / "field_stats"
    ctx, players = committed()
    assert json.load(open(out / "players.json")) == players
    page = (out / "statcaddy-field-stats.html").read_text()
    assert bfs.render_page(ctx, players) == page
    assert bfs.build_embed(ctx, players) == (out / "wp-embed.html").read_text()
