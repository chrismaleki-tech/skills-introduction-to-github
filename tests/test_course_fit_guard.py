"""The deploy must not publish a week whose course fit belongs to the previous event.

Data Golf names a new field days before it re-cuts the course-fit decompositions. Fit and
history are the two largest weights in the model, so deploying inside that window puts last
week's course on the simulator.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "datagolf"))

import deploy_simulator  # noqa: E402
from deploy_simulator import course_fit_event, course_fit_is_stale  # noqa: E402


@pytest.mark.parametrize("field,fit", [
    ("BMW Championship", "FedEx St. Jude Championship"),   # the real case on 2026-08-17
    ("BMW Championship", None),                            # feed not published yet
    ("BMW Championship", ""),
    ("TOUR Championship", "BMW Championship"),
])
def test_a_different_event_is_stale(field, fit):
    assert course_fit_is_stale(field, fit) is True


@pytest.mark.parametrize("field,fit", [
    ("BMW Championship", "BMW Championship"),
    ("BMW Championship", "bmw championship"),          # case
    ("BMW  Championship", "BMW Championship"),         # spacing
    ("Genesis Scottish Open", "Genesis Scottish Open"),
])
def test_the_same_event_is_current(field, fit):
    assert course_fit_is_stale(field, fit) is False


def test_the_event_and_course_are_both_reported(monkeypatch):
    monkeypatch.setattr(deploy_simulator, "dg_get", lambda *a, **k: {
        "event_name": "BMW Championship", "course_name": "Bellerive Country Club", "players": []})
    assert course_fit_event("k", "pga") == ("BMW Championship", "Bellerive Country Club")


def test_a_feed_missing_those_keys_reads_as_stale(monkeypatch):
    monkeypatch.setattr(deploy_simulator, "dg_get", lambda *a, **k: {})
    fit_event, fit_course = course_fit_event("k", "pga")
    assert (fit_event, fit_course) == (None, None)
    assert course_fit_is_stale("BMW Championship", fit_event) is True


def test_the_guard_is_read_from_the_decompositions_feed(monkeypatch):
    """It must read the feed that supplies fit and history, not the field feed."""
    seen = []

    def fake(path, key, **params):
        seen.append(path)
        return {"event_name": "BMW Championship", "course_name": "Bellerive Country Club"}

    monkeypatch.setattr(deploy_simulator, "dg_get", fake)
    course_fit_event("k", "pga")
    assert seen == ["/preds/player-decompositions"]
