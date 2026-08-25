"""Clearing SiteGround's page cache at the end of a deploy.

Signed-out visitors are served from SiteGround's page cache, and the deploy deliberately
parks a "Simulator Currently Disabled" page there for the length of the rebuild. Purging is
therefore the step that actually publishes the week's work.

It was looking for an admin-bar node id the plugin does not use, and skipping the purge in
silence when it found nothing. On 2026-08-25 the deploy reported success, the setting really
was `enabled`, and members still got the disabled page — a deploy nobody could see. The purge
now follows the real control and the run does not claim success until a signed-out request
comes back live.
"""

import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "datagolf"))

import deploy_simulator  # noqa: E402
from deploy_simulator import (  # noqa: E402
    DISABLED_MARK,
    PURGE_ATTEMPTS,
    PURGE_ITEM,
    Deployer,
    public_page_disabled,
)

BASE = "https://wordpress.example"
PURGE_HREF = BASE + "/wp-admin/admin-ajax.php?action=admin_bar_purge&nonce=abc123"


class FakeLocator:
    def __init__(self, page, selector):
        self.page, self.selector = page, selector

    @property
    def first(self):
        return self

    def count(self):
        return 1 if self.selector == PURGE_ITEM and self.page.has_purge_control else 0

    def get_attribute(self, name):
        return PURGE_HREF if name == "href" else None


class FakePage:
    def __init__(self, has_purge_control=True):
        self.has_purge_control = has_purge_control
        self.gotos = []
        self.slept_ms = 0

    def goto(self, url, **_):
        self.gotos.append(url)

    def locator(self, selector):
        return FakeLocator(self, selector)

    def wait_for_timeout(self, ms):
        self.slept_ms += ms


def deployer(has_purge_control=True):
    pg = FakePage(has_purge_control)
    return Deployer(pg, BASE), pg


# ── triggering the purge ────────────────────────────────────────────────────

def test_the_purge_follows_the_admin_bar_control():
    d, pg = deployer()
    assert d.purge_cache() is True
    assert PURGE_HREF in pg.gotos


def test_a_missing_purge_control_is_reported_rather_than_ignored():
    """The regression: a wrong selector made this a silent no-op."""
    d, pg = deployer(has_purge_control=False)
    assert d.purge_cache() is False
    assert PURGE_HREF not in pg.gotos


def test_the_control_is_the_one_the_plugin_actually_renders():
    assert PURGE_ITEM == "#wp-admin-bar-SG_CachePress_Supercacher_Purge a"
    assert "sg-cachepress-purge" not in PURGE_ITEM


# ── confirming the public page went live ────────────────────────────────────

@pytest.fixture
def public_page(monkeypatch):
    """Signed-out page that clears after `state['stale_checks']` checks."""
    state = {"stale_checks": 0, "checks": 0}

    def fake(base):
        state["checks"] += 1
        return state["checks"] <= state["stale_checks"]

    monkeypatch.setattr(deploy_simulator, "public_page_disabled", fake)
    return state


def test_a_page_that_is_already_live_settles_immediately(public_page):
    d, pg = deployer()
    assert d.settle_public_page() is True
    assert public_page["checks"] == 1


def test_a_briefly_stale_page_is_waited_out(public_page):
    public_page["stale_checks"] = 3
    d, pg = deployer()
    assert d.settle_public_page() is True
    assert pg.slept_ms > 0


def test_a_page_that_stays_stale_is_purged_again(public_page):
    public_page["stale_checks"] = 8   # outlasts the first round of checks
    d, pg = deployer()
    assert d.settle_public_page() is True
    assert pg.gotos.count(PURGE_HREF) >= 2


def test_a_cache_that_never_lets_go_is_a_failure_not_a_success(public_page):
    public_page["stale_checks"] = 10_000
    d, pg = deployer()
    assert d.settle_public_page() is False
    assert pg.gotos.count(PURGE_HREF) == PURGE_ATTEMPTS


def test_the_run_does_not_report_success_on_a_cache_it_could_not_clear():
    source = (REPO / "datagolf" / "deploy_simulator.py").read_text()
    settle = source.index("settle_public_page()")
    success = source.index('log(f"SUCCESS')
    assert settle < success, "the public page must be confirmed before success is logged"


# ── reading the signed-out page ─────────────────────────────────────────────

class FakeResponse:
    def __init__(self, text):
        self.text = text


@pytest.fixture
def captured_get(monkeypatch):
    calls = {}

    def fake_get(url, timeout=None, headers=None):
        calls["url"], calls["headers"] = url, headers
        return FakeResponse(calls.get("body", ""))

    monkeypatch.setattr(deploy_simulator.requests, "get", fake_get)
    return calls


def test_the_disabled_page_is_recognised(captured_get):
    captured_get["body"] = f"<h3>{DISABLED_MARK}</h3><p>We are currently updating player stats</p>"
    assert public_page_disabled(BASE) is True


def test_a_live_page_is_recognised(captured_get):
    captured_get["body"] = "<h3>TOUR Championship</h3><p>August 27-30</p>"
    assert public_page_disabled(BASE) is False


def test_the_signed_out_simulator_page_is_the_one_read(captured_get):
    public_page_disabled(BASE + "/")
    assert captured_get["url"] == BASE + "/matchup-simulator/"


def test_the_check_asks_as_a_browser_would(captured_get):
    """A bare client UA draws SiteGround's bot challenge instead of the page."""
    public_page_disabled(BASE)
    assert "Mozilla/5.0" in captured_get["headers"]["User-Agent"]
