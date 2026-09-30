"""Reaching the wp-admin login form when SiteGround puts a challenge in front of it.

The weekly deploy of 2026-08-24 built the TOUR Championship field correctly and then died
signing in: /golflogin answered with SiteGround's JS interstitial (/.well-known/sgcaptcha/)
rather than the form, and the fill of #user_login burned Playwright's default 30s timeout
waiting for a form that was not on the page yet. The simulator stayed disabled all week
because nothing re-attempts before the next Monday cron.

The interstitial does clear itself, so the fix is to wait it out and retry rather than to
treat the first missing form as fatal.
"""

import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "datagolf"))

from deploy_simulator import (  # noqa: E402
    LOGIN_ATTEMPTS,
    LOGIN_FORM,
    LOGIN_FORM_TIMEOUT_MS,
    Deployer,
)

BASE = "https://wordpress.example"
CHALLENGE = BASE + "/.well-known/sgcaptcha/?r=%2Fgolflogin&y=ipr:172.171.12.41:1787579402"
FORM_PAGE = BASE + "/wp-login.php?sgs-token=golflogin"


class FakePage:
    """A page that serves the challenge for the first `challenged` navigations.

    `challenged=0` is the unprotected case; a value at or above LOGIN_ATTEMPTS never clears.
    """

    def __init__(self, challenged=0):
        self.challenged = challenged
        self.gotos = []
        self.waited_for = []
        self.slept_ms = 0
        self.filled = {}
        self.clicked = []
        self.url = BASE

    def goto(self, url, **_):
        self.gotos.append(url)
        if self.challenged > 0:
            self.challenged -= 1
            self.url = CHALLENGE
        else:
            self.url = FORM_PAGE if "golflogin" in url else url

    def wait_for_selector(self, selector, timeout=30_000):
        self.waited_for.append((selector, timeout))
        if self.url == CHALLENGE:
            raise TimeoutError(f"Timeout {timeout}ms exceeded waiting for {selector}")

    def wait_for_timeout(self, ms):
        self.slept_ms += ms

    def fill(self, selector, value):
        if self.url == CHALLENGE:
            raise AssertionError(f"tried to fill {selector} on the challenge page")
        self.filled[selector] = value

    def click(self, selector, **_):
        self.clicked.append(selector)
        if selector == "#wp-submit":
            self.url = BASE + "/wp-admin/index.php"

    def wait_for_load_state(self, *_a, **_k):
        pass

    def locator(self, *_a, **_k):
        raise AssertionError("unexpected locator use")


def deployer(challenged=0):
    pg = FakePage(challenged)
    return Deployer(pg, BASE), pg


def test_an_unprotected_login_page_is_opened_once():
    d, pg = deployer(challenged=0)
    d.open_login()
    assert pg.gotos == [f"{BASE}/golflogin"]
    assert pg.slept_ms == 0


def test_the_challenge_is_waited_out_rather_than_treated_as_fatal():
    d, pg = deployer(challenged=1)
    d.open_login()
    assert len(pg.gotos) == 2
    assert pg.url == FORM_PAGE


def test_the_form_is_awaited_for_longer_than_playwright_would_wait_by_default():
    """The regression: a 30s default is short enough for the datacentre variant to outlast."""
    d, pg = deployer(challenged=0)
    d.open_login()
    assert pg.waited_for == [(LOGIN_FORM, LOGIN_FORM_TIMEOUT_MS)]
    assert LOGIN_FORM_TIMEOUT_MS > 30_000


def test_a_challenge_that_never_clears_still_fails_the_run():
    d, pg = deployer(challenged=LOGIN_ATTEMPTS)
    with pytest.raises(SystemExit) as err:
        d.open_login()
    assert "/golflogin" in str(err.value)
    assert len(pg.gotos) == LOGIN_ATTEMPTS


def test_retries_are_bounded_so_a_blocked_run_does_not_hang():
    d, pg = deployer(challenged=LOGIN_ATTEMPTS)
    with pytest.raises(SystemExit):
        d.open_login()
    assert len(pg.waited_for) == LOGIN_ATTEMPTS
    assert pg.slept_ms <= LOGIN_ATTEMPTS * 10_000


def test_credentials_are_only_typed_once_the_real_form_is_up():
    """FakePage.fill raises if it is reached while the challenge is still showing."""
    d, pg = deployer(challenged=1)
    d.login("wp-user", "hunter2")
    assert pg.filled["#user_login"] == "wp-user"
    assert pg.filled["#user_pass"] == "hunter2"
    assert "#wp-submit" in pg.clicked


def test_a_login_that_lands_somewhere_other_than_wp_admin_is_rejected():
    d, pg = deployer(challenged=0)
    pg.click = lambda *_a, **_k: None  # submit that never reaches the dashboard
    with pytest.raises(SystemExit):
        d.login("wp-user", "hunter2")
