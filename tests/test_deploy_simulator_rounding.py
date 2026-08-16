"""Rounding invariants for the matchup file uploaded to statcaddygolf.com.

The simulator displays `wins_of_10000 / 100` rounded to one decimal with PHP's round(),
which lifts a half away from zero. These tests pin the properties that keep the two halves
of a matchup adding up to 100 on screen.
"""

import csv
import itertools
import random
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import pytest
from scipy.stats import norm

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "datagolf"))

from deploy_simulator import DEFAULT_WEIGHTS, EXPORT_MAP, K_SCALE, build_sim_csv  # noqa: E402

FIELD_SIZES = [2, 3, 40]


def displayed(count):
    """What the simulator shows for a win count. PHP's round() rounds a half away from zero."""
    return float(Decimal(repr(count / 100)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def make_export(n, seed=0):
    """A field of `n` players shaped like the site's player export."""
    rng = random.Random(seed)
    return [
        {"id": str(1000 + i), **{f: round(rng.uniform(-2.5, 2.5), 4) for f in EXPORT_MAP}}
        for i in range(n)
    ]


def read_rows(path):
    with open(path) as f:
        return [(a, b, pct, int(cnt)) for a, b, pct, cnt in csv.reader(f)]


@pytest.fixture(params=FIELD_SIZES, ids=lambda n: f"{n}players")
def built(request, tmp_path):
    export = make_export(request.param)
    path = tmp_path / "sim.csv"
    lookup = build_sim_csv(export, DEFAULT_WEIGHTS, str(path))
    return export, read_rows(path), lookup


def test_every_ordered_pairing_is_written(built):
    export, rows, _ = built
    ids = [p["id"] for p in export]
    assert len(rows) == len(ids) * (len(ids) - 1)
    assert {(a, b) for a, b, _, _ in rows} == set(itertools.permutations(ids, 2))


def test_counts_land_on_a_tenth_of_a_percent(built):
    _, rows, _ = built
    assert all(cnt % 10 == 0 for _, _, _, cnt in rows)


def test_counts_stay_inside_the_range(built):
    _, rows, _ = built
    assert all(0 <= cnt <= 10000 for _, _, _, cnt in rows)


def test_opposite_sides_of_a_pairing_are_complementary(built):
    _, rows, _ = built
    counts = {(a, b): cnt for a, b, _, cnt in rows}
    assert all(cnt + counts[(b, a)] == 10000 for (a, b), cnt in counts.items())


def test_displayed_percentages_total_100(built):
    """The regression this file exists for: no matchup may show 99.9 or 100.1."""
    _, rows, _ = built
    counts = {(a, b): cnt for a, b, _, cnt in rows}
    totals = {
        round(displayed(cnt) + displayed(counts[(b, a)]), 4) for (a, b), cnt in counts.items()
    }
    assert totals == {100.0}


def test_percentage_column_matches_the_count_column(built):
    """The simulator reads the count column, so the two must not disagree."""
    _, rows, _ = built
    assert all(float(pct) == displayed(cnt) == cnt / 100 for _, _, pct, cnt in rows)


def test_percentage_column_is_written_to_one_decimal(built):
    _, rows, _ = built
    assert all(pct.count(".") == 1 and len(pct.split(".")[1]) == 1 for _, _, pct, _ in rows)


def test_returned_lookup_matches_the_file(built):
    _, rows, lookup = built
    assert lookup == {(a, b): cnt / 100 for a, b, _, cnt in rows}


def test_stronger_player_is_favoured(tmp_path):
    """Quantising must not disturb the ordering the model produces."""
    export = make_export(12, seed=3)
    ratings = {
        p["id"]: sum(DEFAULT_WEIGHTS[EXPORT_MAP[f]] * float(p[f]) for f in EXPORT_MAP)
        for p in export
    }
    lookup = build_sim_csv(export, DEFAULT_WEIGHTS, str(tmp_path / "sim.csv"))
    for (a, b), pct in lookup.items():
        if abs(ratings[a] - ratings[b]) > 0.5:  # skip pairs the grid can legitimately tie
            assert (pct > 50) == (ratings[a] > ratings[b])


def test_quantising_moves_a_number_by_at_most_a_tenth(tmp_path):
    export = make_export(40, seed=5)
    lookup = build_sim_csv(export, DEFAULT_WEIGHTS, str(tmp_path / "sim.csv"))
    ratings = {
        p["id"]: sum(DEFAULT_WEIGHTS[EXPORT_MAP[f]] * float(p[f]) for f in EXPORT_MAP)
        for p in export
    }
    for (a, b), pct in lookup.items():
        exact = float(norm.cdf(K_SCALE * (ratings[a] - ratings[b]))) * 100
        assert abs(pct - exact) <= 0.05 + 1e-9


def test_the_previous_implementation_did_show_totals_of_100_1(tmp_path):
    """Documents the bug: independent rounding of each side used to overshoot."""
    export = make_export(40, seed=5)
    ratings = {
        p["id"]: sum(DEFAULT_WEIGHTS[EXPORT_MAP[f]] * float(p[f]) for f in EXPORT_MAP)
        for p in export
    }
    ids = [p["id"] for p in export]
    old = {
        (a, b): round(float(norm.cdf(K_SCALE * (ratings[a] - ratings[b]))) * 10000)
        for a, b in itertools.permutations(ids, 2)
    }
    old_totals = {
        round(displayed(cnt) + displayed(old[(b, a)]), 4) for (a, b), cnt in old.items()
    }
    assert 100.1 in old_totals

    new = build_sim_csv(export, DEFAULT_WEIGHTS, str(tmp_path / "sim.csv"))
    assert {round(pct + new[(b, a)], 4) for (a, b), pct in new.items()} == {100.0}


def test_two_identical_players_split_evenly(tmp_path):
    twin = {f: 0.5 for f in EXPORT_MAP}
    export = [{"id": "1", **twin}, {"id": "2", **twin}]
    lookup = build_sim_csv(export, DEFAULT_WEIGHTS, str(tmp_path / "sim.csv"))
    assert lookup == {("1", "2"): 50.0, ("2", "1"): 50.0}


def test_a_hopeless_mismatch_stays_inside_the_range(tmp_path):
    export = [
        {"id": "1", **{f: 9.0 for f in EXPORT_MAP}},
        {"id": "2", **{f: -9.0 for f in EXPORT_MAP}},
    ]
    lookup = build_sim_csv(export, DEFAULT_WEIGHTS, str(tmp_path / "sim.csv"))
    assert lookup[("1", "2")] == 100.0 and lookup[("2", "1")] == 0.0
