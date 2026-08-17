"""The date label shown under the tournament name on the simulator.

The label used to be typed by hand into an ACF text box and was never revisited, so most of
the calendar still carried the previous season's dates. It is now derived from Data Golf's
schedule: the Thursday of round one through the Sunday three days later, month spelled out.
"""

import csv
import datetime
import re
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "datagolf"))

import deploy_simulator  # noqa: E402
from deploy_simulator import DAYS_TO_FINAL_ROUND, event_start_date, format_event_dates  # noqa: E402

SCHEDULE = REPO / "datagolf" / "data" / "dg_schedule.csv"
FULL_MONTHS = ("January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December")


def pga_schedule():
    with open(SCHEDULE) as f:
        return [r for r in csv.DictReader(f) if r["tour"] == "pga"]


@pytest.mark.parametrize("start,expected", [
    ("2026-08-20", "August 20-23"),      # BMW Championship
    ("2026-08-13", "August 13-16"),      # FedEx St. Jude, already correct on the site
    ("2026-02-12", "February 12-15"),    # AT&T Pebble Beach Pro-Am
    ("2026-10-01", "October 1-4"),       # single digit days, no zero padding
    ("2026-04-30", "April 30 - May 3"),  # crosses a month
    ("2026-12-31", "December 31 - January 3"),  # crosses a year
    ("2027-02-25", "February 25-28"),
    ("2028-02-26", "February 26-29"),    # leap year
])
def test_label_reads_the_way_the_site_writes_it(start, expected):
    assert format_event_dates(start) == expected


def test_the_last_day_is_three_days_after_round_one():
    for row in pga_schedule():
        start = datetime.date.fromisoformat(row["start_date"])
        label = format_event_dates(row["start_date"])
        last = int(re.search(r"(\d+)$", label).group(1))
        assert last == (start + datetime.timedelta(days=DAYS_TO_FINAL_ROUND)).day


def test_round_one_is_always_a_thursday():
    """Thursday to Sunday only lines up because Data Golf dates round one, not the pro-am."""
    assert {datetime.date.fromisoformat(r["start_date"]).weekday() for r in pga_schedule()} == {3}


def test_every_event_on_the_schedule_gets_a_sane_label():
    for row in pga_schedule():
        label = format_event_dates(row["start_date"])
        month = label.split()[0]
        assert month in FULL_MONTHS, label
        assert not re.search(r"\b0\d", label), label  # no zero-padded days
        assert "  " not in label and label == label.strip()


def test_the_month_is_never_abbreviated():
    labels = [format_event_dates(r["start_date"]) for r in pga_schedule()]
    assert not any(re.match(r"^[A-Z][a-z]{2}\b\.?\s", lab) and lab.split()[0] not in FULL_MONTHS
                   for lab in labels)


def test_a_cross_month_label_names_both_months():
    label = format_event_dates("2026-04-30")
    assert label.count(" - ") == 1
    first, second = label.split(" - ")
    assert first.split()[0] in FULL_MONTHS and second.split()[0] in FULL_MONTHS


def test_the_label_is_not_locale_dependent():
    """strftime('%B') would follow the runner's locale; the month names are spelled out."""
    import locale
    label = format_event_dates("2026-08-20")
    for loc in ("C", "de_DE.UTF-8", "fr_FR.UTF-8"):
        try:
            locale.setlocale(locale.LC_TIME, loc)
        except locale.Error:
            continue
        assert format_event_dates("2026-08-20") == label == "August 20-23"
    locale.setlocale(locale.LC_TIME, "C")


# ── looking the event up on the schedule ─────────────────────────────────────

SCHEDULE_STUB = {"schedule": [
    {"event_name": "BMW Championship", "start_date": "2026-08-20"},
    {"event_name": "Butterfield Bermuda Championship", "start_date": "2026-10-22"},
    {"event_name": "The Genesis Invitational", "start_date": "2026-02-19"},
]}


@pytest.fixture
def stub_schedule(monkeypatch):
    calls = []

    def fake(path, key, **params):
        calls.append((path, params))
        return SCHEDULE_STUB

    monkeypatch.setattr(deploy_simulator, "dg_get", fake)
    return calls


def test_the_event_is_found_on_the_schedule(stub_schedule):
    assert event_start_date("k", "pga", "BMW Championship") == "2026-08-20"
    assert stub_schedule == [("/get-schedule", {"tour": "pga"})]


def test_the_lookup_ignores_case_and_spacing(stub_schedule):
    assert event_start_date("k", "pga", "bmw   championship") == "2026-08-20"


def test_an_event_missing_from_the_schedule_returns_nothing(stub_schedule):
    assert event_start_date("k", "pga", "Procore Championship") is None


def test_a_schedule_without_the_expected_shape_is_survivable(monkeypatch):
    for payload in ({}, {"schedule": []}, {"schedule": [{"event_name": None}]}):
        monkeypatch.setattr(deploy_simulator, "dg_get", lambda *a, **k: payload)
        assert event_start_date("k", "pga", "BMW Championship") is None


def test_end_to_end_label_for_the_event_being_activated(stub_schedule):
    start = event_start_date("k", "pga", "BMW Championship")
    assert format_event_dates(start) == "August 20-23"


# ── the values already on the live site ──────────────────────────────────────

def test_labels_match_the_terms_that_were_already_right():
    """These four were correct in WordPress; the generated label must not churn them."""
    already_correct = {
        "FedEx St. Jude Championship": "August 13-16",
        "AT&T Pebble Beach Pro-Am": "February 12-15",
        "The American Express": "January 22-25",
        "The Genesis Invitational": "February 19-22",
    }
    by_name = {r["event_name"]: r for r in pga_schedule()}
    for name, expected in already_correct.items():
        assert name in by_name, f"{name} missing from the committed schedule"
        assert format_event_dates(by_name[name]["start_date"]) == expected


def test_labels_replace_the_stale_ones():
    """The terms still holding 2025 dates, and what they become."""
    stale_then_now = {
        "BMW Championship": ("August 14-17", "August 20-23"),
        "Charles Schwab Challenge": ("May 22-25", "May 28-31"),
        "Bank of Utah Championship": ("Oct 23-26", "October 1-4"),
        "Butterfield Bermuda Championship": ("Nov 13-16", "October 22-25"),
        "John Deere Classic": ("July 3-6", "July 2-5"),
    }
    by_name = {r["event_name"]: r for r in pga_schedule()}
    for name, (stale, fixed) in stale_then_now.items():
        label = format_event_dates(by_name[name]["start_date"])
        assert label == fixed
        assert label != stale
