"""Turning Data Golf's per-event JSON into one row per player per round.

The historical rounds feed nests each round under a `round_N` key and only fills in the
stat blocks a tour is actually modelled for, so the flattening has to survive events with
no strokes gained, players who missed the cut, and tours that carry nothing but scores.
"""

import csv
import json
import os
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "datagolf"))

import pull_history  # noqa: E402
from pull_history import (  # noqa: E402
    EVENT_COLUMNS,
    KNOWN_ROUND_STATS,
    PLAYER_COLUMNS,
    build_header,
    default_out_path,
    event_rows,
    parse_years,
    round_number,
    select_events,
    write_csv,
)

PGA_EVENT = {
    "calendar_year": 2024,
    "date": "2024-05-19",
    "event_id": 33,
    "event_name": "PGA Championship",
    "sg_categories": "yes",
    "tour": "pga",
    "traditional_stats": "yes",
}

PGA_PAYLOAD = {
    "event_completed": "2024-05-19",
    "event_id": 33,
    "event_name": "PGA Championship",
    "season": 2024,
    "sg_categories": "yes",
    "tour": "pga",
    "traditional_stats": "yes",
    "year": 2024,
    "scores": [
        {
            "dg_id": 19895,
            "fin_text": "1",
            "player_name": "Schauffele, Xander",
            "round_1": {"course_name": "Valhalla Golf Club", "course_par": 71, "score": 62,
                        "sg_total": 9.276, "sg_putt": 4.16, "driving_dist": 299.6, "gir": 0.778},
            "round_2": {"course_name": "Valhalla Golf Club", "course_par": 71, "score": 68,
                        "sg_total": 3.052, "sg_putt": -1.038, "driving_dist": 296.8, "gir": 0.833},
        },
        {
            "dg_id": 12345,
            "fin_text": "CUT",
            "player_name": "Missedcut, A",
            "round_1": {"course_name": "Valhalla Golf Club", "course_par": 71, "score": 78},
            "round_2": {"course_name": "Valhalla Golf Club", "course_par": 71, "score": 75},
        },
    ],
}


def rows_for(event=PGA_EVENT, payload=PGA_PAYLOAD):
    return list(event_rows(event, payload))


# ── one row per player per round ─────────────────────────────────────────────

def test_a_row_is_written_for_every_round_every_player_played():
    rows = rows_for()
    assert len(rows) == 4
    assert [(r["dg_id"], r["round_num"]) for r in rows] == [(19895, 1), (19895, 2), (12345, 1), (12345, 2)]


def test_rounds_come_out_in_playing_order_however_the_json_is_ordered():
    shuffled = {**PGA_PAYLOAD, "scores": [{
        "dg_id": 1, "player_name": "Z", "fin_text": "T2",
        "round_4": {"score": 70}, "round_1": {"score": 68},
        "round_3": {"score": 69}, "round_2": {"score": 71},
    }]}
    assert [r["round_num"] for r in event_rows(PGA_EVENT, shuffled)] == [1, 2, 3, 4]


def test_the_scores_of_each_round_land_on_their_own_row():
    rows = rows_for()
    assert [r["score"] for r in rows] == [62, 68, 78, 75]


def test_a_player_who_missed_the_cut_keeps_the_rounds_he_did_play():
    cut = [r for r in rows_for() if r["fin_text"] == "CUT"]
    assert len(cut) == 2
    assert all(r["player_name"] == "Missedcut, A" for r in cut)


def test_a_withdrawal_after_one_round_yields_exactly_one_row():
    wd = {**PGA_PAYLOAD, "scores": [
        {"dg_id": 7, "player_name": "Withdrew, W", "fin_text": "WD", "round_1": {"score": 74}},
    ]}
    rows = list(event_rows(PGA_EVENT, wd))
    assert len(rows) == 1 and rows[0]["round_num"] == 1


# ── the event's identity travels with every row ──────────────────────────────

def test_every_row_carries_the_event_it_came_from():
    for row in rows_for():
        assert row["tour"] == "pga"
        assert row["calendar_year"] == 2024
        assert row["event_id"] == 33
        assert row["event_name"] == "PGA Championship"
        assert row["event_date"] == "2024-05-19"
        assert row["event_completed"] == "2024-05-19"


def test_the_event_date_comes_from_the_catalog_which_the_payload_does_not_repeat():
    """`date` is only on the event list; without it a row cannot be placed in the season."""
    assert "date" not in PGA_PAYLOAD
    assert all(r["event_date"] == "2024-05-19" for r in rows_for())


def test_the_year_is_the_calendar_year_not_the_season_label():
    """Some tours label a season by the year it began, so the two disagree."""
    wrap_around = {**PGA_PAYLOAD, "season": 2023}
    rows = list(event_rows(PGA_EVENT, wrap_around))
    assert all(r["calendar_year"] == 2024 and r["season"] == 2023 for r in rows)


def test_the_coverage_flags_say_which_stats_a_row_can_be_expected_to_have():
    assert all(r["sg_categories"] == "yes" and r["traditional_stats"] == "yes" for r in rows_for())


# ── tours Data Golf does not model to the same depth ─────────────────────────

SCORES_ONLY_EVENT = {"calendar_year": 2025, "date": "2025-03-02", "event_id": 900,
                     "event_name": "Minor Tour Open", "sg_categories": "no",
                     "tour": "afr", "traditional_stats": "no"}
SCORES_ONLY_PAYLOAD = {"event_id": 900, "event_name": "Minor Tour Open", "season": 2025,
                       "sg_categories": "no", "tour": "afr", "traditional_stats": "no", "year": 2025,
                       "scores": [{"dg_id": 4, "player_name": "Someone, S", "fin_text": "12",
                                   "round_1": {"score": 70}, "round_2": {"score": 68}}]}


def test_an_event_without_strokes_gained_still_contributes_its_scores():
    rows = list(event_rows(SCORES_ONLY_EVENT, SCORES_ONLY_PAYLOAD))
    assert [r["score"] for r in rows] == [70, 68]


def test_a_stat_a_tour_does_not_carry_is_absent_rather_than_zero():
    """Blank means "not measured"; a zero would read as a league-average round."""
    row = next(iter(event_rows(SCORES_ONLY_EVENT, SCORES_ONLY_PAYLOAD)))
    assert "sg_total" not in row and "driving_dist" not in row


# ── the header ───────────────────────────────────────────────────────────────

def test_the_header_leads_with_the_event_then_the_player_then_the_round():
    header = build_header(set())
    assert header[:len(EVENT_COLUMNS)] == EVENT_COLUMNS
    assert header[len(EVENT_COLUMNS):len(EVENT_COLUMNS) + len(PLAYER_COLUMNS)] == PLAYER_COLUMNS
    assert header[len(EVENT_COLUMNS) + len(PLAYER_COLUMNS)] == "round_num"


def test_the_header_holds_every_stat_data_golf_records_for_a_round():
    header = build_header(set())
    for stat in ("score", "driving_dist", "driving_acc", "gir", "scrambling", "prox_fw", "prox_rgh",
                 "birdies", "bogies", "pars", "eagles_or_better", "doubles_or_worse",
                 "sg_ott", "sg_app", "sg_arg", "sg_putt", "sg_t2g", "sg_total"):
        assert stat in header, stat


def test_the_column_order_does_not_drift_with_the_stats_that_were_seen():
    assert build_header({"sg_total", "score"}) == build_header(set()) == build_header(set(KNOWN_ROUND_STATS))


def test_a_stat_data_golf_adds_later_is_appended_instead_of_dropped():
    header = build_header({"sg_total", "spin_rate", "apex_height"})
    assert header[-2:] == ["apex_height", "spin_rate"]
    assert header[:-2] == build_header(set())


def test_no_column_is_listed_twice():
    header = build_header({"score", "new_stat"})
    assert len(header) == len(set(header))


# ── choosing which events to pull ────────────────────────────────────────────

CATALOG = [
    {"calendar_year": 2023, "date": "2023-06-01", "event_id": 1, "event_name": "Old", "tour": "pga"},
    {"calendar_year": 2024, "date": "2024-06-01", "event_id": 2, "event_name": "B", "tour": "pga"},
    {"calendar_year": 2024, "date": "2024-01-01", "event_id": 3, "event_name": "A", "tour": "euro"},
    {"calendar_year": 2026, "date": "2026-02-01", "event_id": 4, "event_name": "C", "tour": "liv"},
    {"calendar_year": 2027, "date": "2027-02-01", "event_id": 5, "event_name": "Future", "tour": "pga"},
]


def test_only_the_requested_years_are_pulled():
    assert [e["event_id"] for e in select_events(CATALOG, {2024, 2026}, None)] == [3, 2, 4]


def test_a_tour_filter_narrows_the_pull_without_changing_the_years():
    assert [e["event_id"] for e in select_events(CATALOG, {2024, 2026}, {"pga"})] == [2]


def test_no_tour_filter_means_every_tour_data_golf_covers():
    assert {e["tour"] for e in select_events(CATALOG, {2024, 2026}, None)} == {"pga", "euro", "liv"}


def test_events_come_out_oldest_first_so_the_csv_reads_chronologically():
    dates = [e["date"] for e in select_events(CATALOG, {2023, 2024, 2026}, None)]
    assert dates == sorted(dates)


def test_an_undated_event_does_not_break_the_ordering():
    catalog = CATALOG + [{"calendar_year": 2024, "date": None, "event_id": 6, "tour": "pga", "event_name": "?"}]
    assert [e["event_id"] for e in select_events(catalog, {2024}, None)] == [6, 3, 2]


@pytest.mark.parametrize("raw,expected", [
    ("2024", {2024}),
    ("2024,2025,2026", {2024, 2025, 2026}),
    (" 2024 , 2025 ", {2024, 2025}),
    ("2025,2025", {2025}),
])
def test_years_are_read_off_the_command_line(raw, expected):
    assert parse_years(raw) == expected


def test_a_year_that_is_not_a_number_is_rejected_up_front():
    with pytest.raises(Exception):
        parse_years("last-season")


@pytest.mark.parametrize("years,expected", [
    ({2024, 2025, 2026}, "dg_stats_2024_2026.csv"),
    ({2025}, "dg_stats_2025.csv"),
    ({2024, 2026}, "dg_stats_2024_2026.csv"),
])
def test_the_default_filename_names_the_seasons_it_holds(years, expected):
    assert os.path.basename(default_out_path(years)) == expected


# ── round keys ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("key,expected", [
    ("round_1", 1), ("round_4", 4), ("round_5", 5), ("round_10", 10),
    ("dg_id", None), ("player_name", None), ("fin_text", None),
    ("round_", None), ("round_x", None), ("rounds", None),
])
def test_a_round_is_recognised_by_its_key(key, expected):
    assert round_number(key) == expected


def test_a_fifth_round_playoff_is_kept():
    payload = {**PGA_PAYLOAD, "scores": [{"dg_id": 1, "player_name": "P", "fin_text": "1",
                                          "round_4": {"score": 70}, "round_5": {"score": 68}}]}
    assert [r["round_num"] for r in event_rows(PGA_EVENT, payload)] == [4, 5]


# ── malformed responses ──────────────────────────────────────────────────────

@pytest.mark.parametrize("payload", [
    {},
    {"scores": None},
    {"scores": "No data available."},
    {"scores": []},
])
def test_an_event_with_no_scores_contributes_nothing(payload):
    assert list(event_rows(PGA_EVENT, payload)) == []


def test_a_player_entry_that_is_not_a_record_is_skipped():
    payload = {"scores": ["junk", None, {"dg_id": 1, "player_name": "P", "round_1": {"score": 70}}]}
    rows = list(event_rows(PGA_EVENT, payload))
    assert len(rows) == 1 and rows[0]["score"] == 70


def test_a_player_with_no_rounds_contributes_nothing():
    payload = {"scores": [{"dg_id": 1, "player_name": "Nostart, N", "fin_text": "WD"}]}
    assert list(event_rows(PGA_EVENT, payload)) == []


def test_a_nested_value_inside_a_round_is_left_out_of_the_flat_row():
    payload = {"scores": [{"dg_id": 1, "player_name": "P", "round_1": {"score": 70, "holes": [1, 2, 3]}}]}
    row = next(iter(event_rows(PGA_EVENT, payload)))
    assert row["score"] == 70 and "holes" not in row


# ── the CSV on disk ──────────────────────────────────────────────────────────

@pytest.fixture
def cache(tmp_path):
    cache_dir = tmp_path / "_cache"
    cache_dir.mkdir()
    for event, payload in ((PGA_EVENT, PGA_PAYLOAD), (SCORES_ONLY_EVENT, SCORES_ONLY_PAYLOAD)):
        name = f"{event['calendar_year']}_{event['tour']}_{event['event_id']}.json"
        (cache_dir / name).write_text(json.dumps(payload))
    return cache_dir


def read_csv(path):
    with open(path, newline="") as fh:
        return list(csv.DictReader(fh))


def test_one_csv_holds_every_tour_and_every_season(cache, tmp_path):
    out = tmp_path / "stats.csv"
    rows, events, header = write_csv([PGA_EVENT, SCORES_ONLY_EVENT], str(cache), str(out), "NOW")
    assert (rows, events) == (6, 2)
    written = read_csv(out)
    assert {r["tour"] for r in written} == {"pga", "afr"}
    assert {r["calendar_year"] for r in written} == {"2024", "2025"}


def test_every_row_is_stamped_with_when_it_was_pulled(cache, tmp_path):
    out = tmp_path / "stats.csv"
    write_csv([PGA_EVENT, SCORES_ONLY_EVENT], str(cache), str(out), "2026-08-25T00:00:00+00:00")
    assert {r["pulled_at"] for r in read_csv(out)} == {"2026-08-25T00:00:00+00:00"}


def test_the_stats_a_tour_does_not_carry_are_blank_not_missing_columns(cache, tmp_path):
    out = tmp_path / "stats.csv"
    write_csv([PGA_EVENT, SCORES_ONLY_EVENT], str(cache), str(out), "NOW")
    minor = [r for r in read_csv(out) if r["tour"] == "afr"]
    assert minor and all(r["sg_total"] == "" and r["driving_dist"] == "" for r in minor)


def test_an_event_missing_from_the_cache_is_skipped_rather_than_failing_the_run(cache, tmp_path):
    out = tmp_path / "stats.csv"
    absent = {**PGA_EVENT, "event_id": 99999, "event_name": "Never fetched"}
    rows, events, _ = write_csv([PGA_EVENT, absent, SCORES_ONLY_EVENT], str(cache), str(out), "NOW")
    assert (rows, events) == (6, 2)


def test_a_half_written_csv_never_replaces_a_good_one(cache, tmp_path, monkeypatch):
    out = tmp_path / "stats.csv"
    write_csv([PGA_EVENT], str(cache), str(out), "FIRST")
    good = out.read_text()

    def explode(event, payload):
        raise RuntimeError("connection reset mid-write")

    monkeypatch.setattr(pull_history, "event_rows", explode)
    with pytest.raises(RuntimeError):
        write_csv([PGA_EVENT], str(cache), str(out), "SECOND")
    assert out.read_text() == good
    assert not [p for p in os.listdir(tmp_path) if p.endswith(".tmp")]
