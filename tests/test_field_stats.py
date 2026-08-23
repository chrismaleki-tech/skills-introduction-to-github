"""The field stats report built from the CSV snapshots in datagolf/data/.

Two kinds of test: synthetic snapshots written to tmp_path, which pin the arithmetic and
the shape of the report, and a pass over the committed snapshots, which catches a field
that no longer joins to the skill ratings or the pre-tournament probabilities.
"""

import json
import sys
from pathlib import Path

import pandas as pd
import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "datagolf"))

import field_stats  # noqa: E402
from field_stats import (  # noqa: E402
    FieldStatsError,
    build_field,
    collect_stats,
    display_name,
    format_event_dates,
    render,
    tee_time_windows,
    wrap_entries,
)

DATA_DIR = REPO / "datagolf" / "data"

FIELD_ROWS = [
    {"dg_id": 1, "player_name": "Alpha, Ann", "country": "USA", "am": 0,
     "dg_rank": 1, "owgr_rank": 2, "tour_rank": 1},
    {"dg_id": 2, "player_name": "Beta, Bob", "country": "ENG", "am": 0,
     "dg_rank": 20, "owgr_rank": 30, "tour_rank": 2},
    {"dg_id": 3, "player_name": "Gamma, Gus", "country": "USA", "am": 1,
     "dg_rank": 120, "owgr_rank": 140, "tour_rank": 3},
]
SKILL_ROWS = [
    {"dg_id": 1, "player_name": "Alpha, Ann", "sg_total": 2.0, "sg_ott": 0.8, "sg_app": 0.7,
     "sg_arg": 0.3, "sg_putt": 0.2, "driving_dist": 10.0, "driving_acc": 0.05},
    {"dg_id": 2, "player_name": "Beta, Bob", "sg_total": 1.0, "sg_ott": 0.4, "sg_app": 0.3,
     "sg_arg": 0.2, "sg_putt": 0.1, "driving_dist": 0.0, "driving_acc": 0.01},
    {"dg_id": 3, "player_name": "Gamma, Gus", "sg_total": 0.0, "sg_ott": -0.2, "sg_app": 0.1,
     "sg_arg": 0.0, "sg_putt": 0.1, "driving_dist": -5.0, "driving_acc": -0.02},
    # A rated player who is not in this week's field, so the tour baseline differs from the field.
    {"dg_id": 9, "player_name": "Delta, Dan", "sg_total": -3.0, "sg_ott": -1.0, "sg_app": -1.0,
     "sg_arg": -0.5, "sg_putt": -0.5, "driving_dist": -20.0, "driving_acc": -0.10},
]
PREDICTION_ROWS = [
    {"dg_id": 1, "player_name": "Alpha, Ann", "win": 0.5, "top_5": 0.9, "top_10": 0.95, "top_20": 1.0},
    {"dg_id": 2, "player_name": "Beta, Bob", "win": 0.3, "top_5": 0.7, "top_10": 0.85, "top_20": 1.0},
    {"dg_id": 3, "player_name": "Gamma, Gus", "win": 0.2, "top_5": 0.4, "top_10": 0.70, "top_20": 1.0},
]
TEE_TIMES = [
    [{"course_name": "Test GC", "round_num": 1, "teetime": "2026-08-20 09:00", "wave": "early"},
     {"course_name": "Test GC", "round_num": 2, "teetime": "2026-08-21 13:00", "wave": "late"}],
    [{"course_name": "Test GC", "round_num": 1, "teetime": "2026-08-20 11:30", "wave": "early"},
     {"course_name": "Test GC", "round_num": 2, "teetime": "2026-08-21 14:00", "wave": "late"}],
    [{"course_name": "Test GC", "round_num": 1, "teetime": "2026-08-20 13:45", "wave": "late"},
     {"course_name": "Test GC", "round_num": 2, "teetime": "2026-08-21 09:15", "wave": "early"}],
]


def write_snapshots(directory, field_rows=None, with_teetimes=True):
    field = pd.DataFrame(field_rows if field_rows is not None else FIELD_ROWS)
    field.insert(0, "event_name", "Test Championship")
    field["updated_at"] = "2026-08-23T10:11:27+00:00"
    if with_teetimes:
        field["teetimes"] = [str(times) for times in TEE_TIMES[: len(field)]]
    field.to_csv(directory / "dg_field.csv", index=False)
    pd.DataFrame(SKILL_ROWS).to_csv(directory / "dg_skill_ratings.csv", index=False)
    pd.DataFrame(PREDICTION_ROWS).to_csv(directory / "dg_predictions.csv", index=False)
    pd.DataFrame([{"event_name": "Test Championship", "course": "Test GC", "location": "Nowhere, XX",
                   "tour": "pga", "start_date": "2026-08-20"}]).to_csv(
        directory / "dg_schedule.csv", index=False)
    return directory


@pytest.fixture
def synthetic(tmp_path):
    directory = write_snapshots(tmp_path)
    field, skills, context = build_field(str(directory))
    return field, skills, context, collect_stats(field, skills, context, top=3)


# ── Helpers ────────────────────────────────────────────────────────────────


def test_data_golf_names_are_flipped_for_display():
    assert display_name("Scheffler, Scottie") == "Scottie Scheffler"
    assert display_name("Rory McIlroy") == "Rory McIlroy"


def test_event_dates_run_from_round_one_to_the_final_round():
    assert format_event_dates("2026-08-20") == "August 20-23, 2026"


def test_event_dates_spell_out_both_months_when_the_week_crosses_one():
    assert format_event_dates("2026-04-30") == "April 30 - May 3, 2026"


def test_event_dates_tolerate_a_missing_or_unparseable_schedule_date():
    assert format_event_dates(None) is None
    assert format_event_dates("week of the 20th") is None


def test_entries_are_wrapped_without_splitting_one():
    entries = ", ".join(f"Player {index} +0.500" for index in range(12))
    chunks = wrap_entries(entries, width=40)
    assert all(len(chunk) <= 40 for chunk in chunks)
    assert ", ".join(chunks) == entries


# ── Merge ──────────────────────────────────────────────────────────────────


def test_every_field_player_keeps_one_row_after_the_joins(synthetic):
    field, _, context, _ = synthetic
    assert len(field) == len(FIELD_ROWS) == context["field_size"]
    assert field["dg_id"].is_unique


def test_event_context_comes_from_the_schedule(synthetic):
    _, _, context, _ = synthetic
    assert context["event_name"] == "Test Championship"
    assert context["course"] == "Test GC"
    assert context["location"] == "Nowhere, XX"
    assert context["tour"] == "PGA Tour"
    assert context["dates"] == "August 20-23, 2026"


def test_a_missing_field_snapshot_is_an_error_not_a_traceback(tmp_path):
    with pytest.raises(FieldStatsError):
        build_field(str(tmp_path))


def test_an_empty_field_snapshot_is_an_error(tmp_path):
    write_snapshots(tmp_path, field_rows=[])
    with pytest.raises(FieldStatsError):
        build_field(str(tmp_path))


def test_optional_snapshots_may_be_absent(tmp_path):
    write_snapshots(tmp_path)
    (tmp_path / "dg_predictions.csv").unlink()
    (tmp_path / "dg_schedule.csv").unlink()
    field, skills, context = build_field(str(tmp_path))
    stats = collect_stats(field, skills, context, top=3)
    assert stats["probabilities"] == {}
    assert stats["event"].get("course") is None
    assert "SG: Total" in render(stats, top=3)


# ── Stats ──────────────────────────────────────────────────────────────────


def test_composition_counts_add_up_to_the_field(synthetic):
    _, _, context, stats = synthetic
    composition = stats["composition"]
    assert sum(composition["countries"].values()) == context["field_size"]
    assert composition["countries"] == {"USA": 2, "ENG": 1}
    assert composition["amateurs"] == 1


def test_rank_buckets_are_cumulative(synthetic):
    _, _, _, stats = synthetic
    buckets = stats["composition"]["dg_rank"]["buckets"]
    assert [buckets["top_10"], buckets["top_25"], buckets["top_50"], buckets["top_100"]] == [1, 2, 2, 2]
    assert stats["composition"]["dg_rank"]["best"] == 1
    assert stats["composition"]["dg_rank"]["worst"] == 120


def test_field_strength_compares_the_field_with_every_rated_player(synthetic):
    _, _, _, stats = synthetic
    strength = stats["strength"]
    assert strength["field_mean"] == pytest.approx(1.0)
    assert strength["rated_mean"] == pytest.approx(0.0)
    # Two of the four rated players sit below the field's +1.0 average.
    assert strength["percentile"] == pytest.approx(50.0)
    assert strength["unrated"] == 0


def test_a_field_player_without_a_skill_rating_is_counted_not_averaged(tmp_path):
    rows = FIELD_ROWS + [{"dg_id": 77, "player_name": "Rookie, Ray", "country": "USA", "am": 0,
                          "dg_rank": 400, "owgr_rank": 500, "tour_rank": 4}]
    write_snapshots(tmp_path, field_rows=rows, with_teetimes=False)
    field, skills, context = build_field(str(tmp_path))
    stats = collect_stats(field, skills, context, top=5)
    assert context["field_size"] == 4
    assert stats["strength"]["unrated"] == 1
    assert stats["strength"]["field_mean"] == pytest.approx(1.0)
    assert stats["metrics"]["sg_total"]["count"] == 3


def test_metric_summaries_report_the_field_leader_and_trailer(synthetic):
    _, _, _, stats = synthetic
    total = stats["metrics"]["sg_total"]
    assert (total["max"], total["leader"]) == (2.0, "Ann Alpha")
    assert (total["min"], total["trailer"]) == (0.0, "Gus Gamma")
    assert total["median"] == pytest.approx(1.0)


def test_category_leaders_are_sorted_best_first(synthetic):
    _, _, _, stats = synthetic
    for column, leaders in stats["sg_leaders"].items():
        values = [entry["value"] for entry in leaders]
        assert values == sorted(values, reverse=True), column


def test_leaderboards_are_capped_at_the_requested_length(tmp_path):
    write_snapshots(tmp_path)
    field, skills, context = build_field(str(tmp_path))
    stats = collect_stats(field, skills, context, top=2)
    assert len(stats["sg_leaders"]["sg_total"]) == 2
    assert len(stats["probabilities"]["win"]["leaders"]) == 2


def test_win_concentration_is_the_favourites_share_of_the_win_pool(synthetic):
    _, _, _, stats = synthetic
    assert stats["win_concentration"]["share"] == pytest.approx(1.0)  # only three players


def test_tee_times_summarise_each_round_and_its_waves(synthetic):
    _, _, _, stats = synthetic
    rounds = {entry["round"]: entry for entry in stats["tee_times"]}
    assert sorted(rounds) == [1, 2]
    assert rounds[1]["players"] == 3
    assert (rounds[1]["first"], rounds[1]["last"]) == ("2026-08-20 09:00", "2026-08-20 13:45")
    assert rounds[1]["waves"] == {"early": 2, "late": 1}


def test_unparseable_tee_times_are_skipped_rather_than_raising():
    frame = pd.DataFrame({"teetimes": ["not a list", None, str(TEE_TIMES[0])]})
    windows = tee_time_windows(frame)
    assert [entry["players"] for entry in windows] == [1, 1]


def test_a_field_without_tee_times_still_reports(tmp_path):
    write_snapshots(tmp_path, with_teetimes=False)
    field, skills, context = build_field(str(tmp_path))
    stats = collect_stats(field, skills, context, top=3)
    assert stats["tee_times"] == []
    assert "TEE TIMES" not in render(stats, top=3)


# ── Output ─────────────────────────────────────────────────────────────────


def test_the_report_names_the_event_and_every_section(synthetic):
    _, _, _, stats = synthetic
    report = render(stats, top=3)
    assert "Test Championship" in report
    for section in ("COMPOSITION", "FIELD STRENGTH", "SKILL DISTRIBUTION",
                    "CATEGORY LEADERS", "PRE-TOURNAMENT PROBABILITIES", "TEE TIMES"):
        assert section in report


def test_the_report_shows_strokes_gained_signed(synthetic):
    _, _, _, stats = synthetic
    assert "+2.000" in render(stats, top=3)


def test_the_stats_are_json_serialisable(synthetic):
    _, _, _, stats = synthetic
    assert json.loads(json.dumps(stats, default=str))["event"]["event_name"] == "Test Championship"


def test_the_exported_table_is_ordered_by_skill(synthetic):
    field, _, _, _ = synthetic
    exported = field_stats.export_columns(field)
    assert list(exported["player"]) == ["Ann Alpha", "Bob Beta", "Gus Gamma"]
    assert "sg_total" in exported.columns


# ── Committed snapshots ────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def committed():
    if not (DATA_DIR / "dg_field.csv").exists() or pd.read_csv(DATA_DIR / "dg_field.csv").empty:
        pytest.skip("no field snapshot committed (off-season)")
    field, skills, context = build_field(str(DATA_DIR))
    return field, skills, context, collect_stats(field, skills, context, top=10)


def test_the_committed_field_joins_to_the_skill_ratings(committed):
    field, _, _, _ = committed
    unrated = field[field["sg_total"].isna()]["player"].tolist()
    assert not unrated, f"field players with no skill rating: {unrated}"


def test_the_committed_field_joins_to_the_pre_tournament_probabilities(committed):
    field, _, _, _ = committed
    missing = field[field["win"].isna()]["player"].tolist()
    assert not missing, f"field players with no win probability: {missing}"


def test_the_committed_win_probabilities_total_one_field(committed):
    field, _, _, _ = committed
    assert field["win"].sum() == pytest.approx(1.0, abs=0.02)


def test_the_committed_field_reports_without_error(committed):
    _, _, context, stats = committed
    report = render(stats, top=10)
    assert context["event_name"] in report
    assert stats["composition"]["country_count"] >= 1
