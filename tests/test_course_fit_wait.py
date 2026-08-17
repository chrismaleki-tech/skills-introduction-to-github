"""Waiting for Data Golf to publish this week's course fit.

Data Golf names the field hours before it re-cuts the course-fit decompositions, and not at a
dependable time of day, so the Monday deploy waits for them instead of assuming an hour.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "datagolf"))

import deploy_simulator  # noqa: E402
from deploy_simulator import wait_for_course_fit  # noqa: E402

THIS_WEEK = "BMW Championship"
LAST_WEEK = "FedEx St. Jude Championship"


@pytest.fixture
def feed(monkeypatch):
    """Serve a scripted sequence of decompositions payloads and record every sleep."""
    state = {"events": [], "slept": []}

    def fake_dg(path, key, **params):
        assert path == "/preds/player-decompositions"
        name = state["events"].pop(0) if len(state["events"]) > 1 else state["events"][0]
        return {"event_name": name, "course_name": f"course for {name}"}

    monkeypatch.setattr(deploy_simulator, "dg_get", fake_dg)
    monkeypatch.setattr(deploy_simulator.time, "sleep", lambda s: state["slept"].append(s))
    return state


def test_a_current_fit_returns_at_once_without_waiting(feed):
    feed["events"] = [THIS_WEEK]
    assert wait_for_course_fit("k", "pga", THIS_WEEK, 300) == (THIS_WEEK, f"course for {THIS_WEEK}")
    assert feed["slept"] == []


def test_no_wait_configured_checks_once_and_gives_up(feed):
    feed["events"] = [LAST_WEEK]
    fit_event, _ = wait_for_course_fit("k", "pga", THIS_WEEK, 0)
    assert fit_event == LAST_WEEK
    assert feed["slept"] == []


def test_it_keeps_checking_until_data_golf_switches_over(feed):
    feed["events"] = [LAST_WEEK, LAST_WEEK, LAST_WEEK, THIS_WEEK]
    fit_event, fit_course = wait_for_course_fit("k", "pga", THIS_WEEK, 300, poll_seconds=600)
    assert fit_event == THIS_WEEK
    assert len(feed["slept"]) == 3, "should have slept between each re-check"
    assert set(feed["slept"]) == {600}


def test_the_wait_is_bounded(feed, monkeypatch):
    """A run must not sit forever if Data Golf never publishes."""
    clock = {"t": 0.0}
    monkeypatch.setattr(deploy_simulator.time, "monotonic", lambda: clock["t"])
    monkeypatch.setattr(deploy_simulator.time, "sleep",
                        lambda s: clock.__setitem__("t", clock["t"] + s))
    feed["events"] = [LAST_WEEK]
    fit_event, _ = wait_for_course_fit("k", "pga", THIS_WEEK, 30, poll_seconds=600)
    assert fit_event == LAST_WEEK
    assert clock["t"] == pytest.approx(30 * 60), "should stop exactly at the deadline"


def test_the_final_poll_does_not_overshoot_the_deadline(feed, monkeypatch):
    clock = {"t": 0.0}
    monkeypatch.setattr(deploy_simulator.time, "monotonic", lambda: clock["t"])
    monkeypatch.setattr(deploy_simulator.time, "sleep",
                        lambda s: clock.__setitem__("t", clock["t"] + s))
    feed["events"] = [LAST_WEEK]
    wait_for_course_fit("k", "pga", THIS_WEEK, 5, poll_seconds=600)
    assert clock["t"] <= 5 * 60 + 1


def test_a_stale_result_still_reads_as_stale(feed):
    feed["events"] = [LAST_WEEK]
    fit_event, _ = wait_for_course_fit("k", "pga", THIS_WEEK, 0)
    assert deploy_simulator.course_fit_is_stale(THIS_WEEK, fit_event) is True
