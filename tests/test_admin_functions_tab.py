"""Opening the ACF "Admin Functions" tab on the player settings screen.

Every write the deploy makes to the settings screen — disabling the simulator, uploading the
Player Data and Simulation Data CSVs, re-enabling at the end — goes through this tab. ACF
builds the visible tab bar in JS after the page loads; until it does, the tab's text is
carried only by a hidden <label> and the hidden anchor it was generated from. A `text=`
click can therefore latch onto a node that is never made visible and spend its whole timeout
on it, which is how the 2026-08-25 deploy stalled after publishing the field.

Selecting the visible tab button and waiting for it makes the click wait for the tab bar to
exist rather than race it.
"""

import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "datagolf"))

from deploy_simulator import ADMIN_TAB, TAB_TIMEOUT_MS, Deployer  # noqa: E402

BASE = "https://wordpress.example"


class El:
    def __init__(self, tag, cls, text, visible):
        self.tag, self.cls, self.text, self.visible = tag, cls, text, visible

    def __repr__(self):
        return f"<{self.tag} class={self.cls!r} visible={self.visible}>"


def settings_dom(tab_bar_built):
    """The three nodes reading 'Admin Functions'; the visible one exists only once ACF runs."""
    dom = [
        El("label", "", ADMIN_TAB, False),                    # hidden ACF label
        El("a", "acf-tab-button", ADMIN_TAB, False),          # hidden source anchor
    ]
    if tab_bar_built:
        dom.insert(0, El("a", "acf-tab-button", ADMIN_TAB, True))
    return dom


class FakeLocator:
    def __init__(self, page, selector, text=None, first=False):
        self.page, self.selector, self.text, self._first = page, selector, text, first

    def _matches(self):
        want_visible = ":visible" in self.selector
        tag = self.selector.split(".")[0].split(":")[0]
        cls = [c.split(":")[0] for c in self.selector.split(".")[1:]]
        out = []
        for el in self.page.dom():
            if tag and el.tag != tag:
                continue
            if any(c not in el.cls for c in cls):
                continue
            if want_visible and not el.visible:
                continue
            if self.text is not None and self.text not in el.text:
                continue
            out.append(el)
        return out

    def filter(self, has_text=None):
        return FakeLocator(self.page, self.selector, has_text, self._first)

    @property
    def first(self):
        return FakeLocator(self.page, self.selector, self.text, True)

    POLL_BUDGET = 50

    def wait_for(self, state="visible", timeout=30_000):
        self.page.waits.append((self.selector, self.text, state, timeout))
        for _ in range(self.POLL_BUDGET):
            if self._matches():
                return
            self.page.tick()
        raise TimeoutError(f"Timeout {timeout}ms exceeded waiting for {self.selector}")

    def click(self, **_):
        hits = self._matches()
        if not hits:
            raise TimeoutError(f"no element for {self.selector}")
        target = hits[0]
        if not target.visible:
            raise TimeoutError(f"element is not visible: {target}")
        self.page.clicked.append(target)


class FakePage:
    """Settings screen whose ACF tab bar appears after `ticks_until_tab_bar` polls."""

    def __init__(self, ticks_until_tab_bar=0):
        self.ticks_until_tab_bar = ticks_until_tab_bar
        self._ticks = 0
        self.gotos, self.clicked, self.waits = [], [], []

    def tick(self):
        self._ticks += 1

    def dom(self):
        return settings_dom(self._ticks >= self.ticks_until_tab_bar)

    def goto(self, url, **_):
        self.gotos.append(url)

    def locator(self, selector):
        return FakeLocator(self, selector)

    def wait_for_timeout(self, _ms):
        pass

    def click(self, *_a, **_k):
        raise AssertionError("page.click bypasses the visible-tab wait")


def deployer(ticks_until_tab_bar=0):
    pg = FakePage(ticks_until_tab_bar)
    return Deployer(pg, BASE), pg


def test_the_tab_is_opened_from_the_settings_screen():
    d, pg = deployer()
    d._admin_functions()
    assert pg.gotos == [d.SET]


def test_the_visible_tab_button_is_the_one_clicked():
    d, pg = deployer()
    d._admin_functions()
    assert [el.visible for el in pg.clicked] == [True]
    assert pg.clicked[0].tag == "a"


def test_a_tab_bar_that_has_not_rendered_yet_is_waited_for():
    """The regression: the click used to land on a hidden node instead of waiting."""
    d, pg = deployer(ticks_until_tab_bar=4)
    d._admin_functions()
    assert pg.clicked[0].visible


def test_the_hidden_label_and_source_anchor_are_never_clicked():
    d, pg = deployer(ticks_until_tab_bar=2)
    d._admin_functions()
    assert all(el.visible and el.tag == "a" for el in pg.clicked)


def test_the_wait_is_explicit_and_generous():
    d, pg = deployer()
    d._admin_functions()
    assert len(pg.waits) == 1
    selector, text, state, timeout = pg.waits[0]
    assert text == ADMIN_TAB
    assert state == "visible"
    assert timeout == TAB_TIMEOUT_MS > 30_000


def test_a_tab_bar_that_never_renders_raises_rather_than_clicking_blind():
    d, pg = deployer(ticks_until_tab_bar=FakeLocator.POLL_BUDGET + 1)
    with pytest.raises(TimeoutError):
        d._admin_functions()
    assert pg.clicked == []


def test_every_settings_write_goes_through_the_same_guarded_tab():
    """set_status/upload_csv must not reintroduce their own unguarded tab click."""
    source = (REPO / "datagolf" / "deploy_simulator.py").read_text()
    assert f'click("text={ADMIN_TAB}")' not in source
    assert source.count("_admin_functions") >= 4
