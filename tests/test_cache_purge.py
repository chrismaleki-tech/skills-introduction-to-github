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
    CHALLENGE_STATUS,
    DISABLED,
    DISABLED_MARK,
    LIVE,
    PURGE_ATTEMPTS,
    PURGE_ITEM,
    UNAVAILABLE,
    Deployer,
    public_page_state,
)

BASE = "https://wordpress.example"
EVENT = "TOUR Championship"
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
    """Signed-out page returning `before` for the first N checks, then `after`."""
    state = {"before": DISABLED, "stale_checks": 0, "after": LIVE, "checks": 0}

    def fake(base, event):
        assert event == EVENT
        state["checks"] += 1
        return state["before"] if state["checks"] <= state["stale_checks"] else state["after"]

    monkeypatch.setattr(deploy_simulator, "public_page_state", fake)
    return state


def test_a_page_that_is_already_live_settles_immediately(public_page):
    d, pg = deployer()
    assert d.settle_public_page(EVENT) is True
    assert public_page["checks"] == 1


def test_a_briefly_stale_page_is_waited_out(public_page):
    public_page["stale_checks"] = 3
    d, pg = deployer()
    assert d.settle_public_page(EVENT) is True
    assert pg.slept_ms > 0


def test_a_page_that_stays_stale_is_purged_again(public_page):
    public_page["stale_checks"] = 8   # outlasts the first round of checks
    d, pg = deployer()
    assert d.settle_public_page(EVENT) is True
    assert pg.gotos.count(PURGE_HREF) >= 2


def test_a_cache_that_never_lets_go_is_a_failure_not_a_success(public_page):
    public_page["stale_checks"] = 10_000
    d, pg = deployer()
    assert d.settle_public_page(EVENT) is False
    assert pg.gotos.count(PURGE_HREF) == PURGE_ATTEMPTS


def test_a_page_that_only_ever_answers_with_the_challenge_is_not_called_live(public_page):
    """The check must learn nothing from a challenge rather than read it as success."""
    public_page["before"] = public_page["after"] = UNAVAILABLE
    d, pg = deployer()
    assert d.settle_public_page(EVENT) is False


def test_the_run_does_not_report_success_on_a_cache_it_could_not_clear():
    source = (REPO / "datagolf" / "deploy_simulator.py").read_text()
    settle = source.index("settle_public_page(event)")
    success = source.index('log(f"SUCCESS')
    assert settle < success, "the public page must be confirmed before success is logged"


# ── reading the signed-out page ─────────────────────────────────────────────

LIVE_HTML = f'<div class="tournament-details"><h3>{EVENT}</h3><p class="dates">August 27-30</p></div>'
DISABLED_HTML = f"<h3>{DISABLED_MARK}</h3><p>We are currently updating player stats</p>"
# What SiteGround actually returned on 1 of 12 signed-out requests: 202, 187 bytes, no page.
CHALLENGE_HTML = ('<html><head><meta http-equiv="refresh" content="0;'
                  '/.well-known/sgcaptcha/?r=%2Fmatchup-simulator%2F"></meta></head></html>')


class FakeResponse:
    def __init__(self, text, status=200, headers=None):
        self.text, self.status_code, self.headers = text, status, headers or {}


@pytest.fixture
def captured_get(monkeypatch):
    calls = {"body": "", "status": 200, "headers": {}}

    def fake_get(url, timeout=None, headers=None):
        calls["url"], calls["sent_headers"] = url, headers
        return FakeResponse(calls["body"], calls["status"], calls["headers"])

    monkeypatch.setattr(deploy_simulator.requests, "get", fake_get)
    return calls


def test_the_live_page_is_recognised(captured_get):
    captured_get["body"] = LIVE_HTML
    assert public_page_state(BASE, EVENT) == LIVE


def test_the_disabled_page_is_recognised(captured_get):
    captured_get["body"] = DISABLED_HTML
    assert public_page_state(BASE, EVENT) == DISABLED


def test_the_bot_challenge_is_not_mistaken_for_a_live_page():
    """The regression this guards: a challenge carries no disabled notice either."""
    assert DISABLED_MARK.lower() not in CHALLENGE_HTML.lower()


@pytest.mark.parametrize("status,headers", [
    (CHALLENGE_STATUS, {}),
    (200, {"SG-Captcha": "challenge"}),
    (200, {}),
])
def test_a_challenged_request_reads_as_unavailable(captured_get, status, headers):
    captured_get["body"], captured_get["status"], captured_get["headers"] = CHALLENGE_HTML, status, headers
    assert public_page_state(BASE, EVENT) == UNAVAILABLE


def test_a_page_naming_no_event_is_not_taken_as_live(captured_get):
    captured_get["body"] = "<h3>BMW Championship</h3><p>August 20-23</p>"
    assert public_page_state(BASE, EVENT) == UNAVAILABLE


def test_the_event_match_ignores_case(captured_get):
    captured_get["body"] = "<h3>tour championship</h3>"
    assert public_page_state(BASE, EVENT) == LIVE


def test_the_signed_out_simulator_page_is_the_one_read(captured_get):
    public_page_state(BASE + "/", EVENT)
    assert captured_get["url"] == BASE + "/matchup-simulator/"


def test_the_check_asks_as_a_browser_would(captured_get):
    """A bare client UA draws SiteGround's bot challenge instead of the page."""
    public_page_state(BASE, EVENT)
    assert "Mozilla/5.0" in captured_get["sent_headers"]["User-Agent"]
