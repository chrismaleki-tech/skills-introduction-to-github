"""Finding, activating and dating the right tournament term.

WordPress paginates the tournament list at 20 terms a screen and a PGA season carries more
than twice that. The deploy used to read only the first screen, so every term that fell onto
a later page was never opened: it could not be activated, and — the visible symptom — its
date label kept whatever was last typed by hand. On 2026-08-25 the TOUR Championship went
live still advertising "August 21-24", the 2025 edition's dates.
"""

import math
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "datagolf"))

from deploy_simulator import TERM_PAGE_LIMIT, Deployer  # noqa: E402

BASE = "https://wordpress.example"
PER_PAGE = 20
SWITCH = "input.acf-switch-input"
DATES_BOX = '.acf-field[data-name="tournament_dates"] input'
SAVE = 'input#submit, input[type="submit"][value="Update"]'

# A season's worth of terms; the target sits well past the first screen, as it does live.
SEASON = ([f"Event {i:02d}" for i in range(1, 31)]
          + ["TOUR Championship"]
          + [f"Event {i:02d}" for i in range(31, 44)])


class Term:
    def __init__(self, tid, name, active=False, dates="", has_switch=True, has_dates=True):
        self.id, self.name, self.active, self.dates = str(tid), name, active, dates
        self.has_switch, self.has_dates = has_switch, has_dates
        self.saves = 0


class FakeLocator:
    def __init__(self, page, selector):
        self.page, self.selector = page, selector

    @property
    def first(self):
        return self

    def _term(self):
        return self.page.current_term

    def count(self):
        if self.selector == "a.next-page":
            return 1 if self.page.has_next_page else 0
        t = self._term()
        if t is None:
            return 0
        if self.selector == SWITCH:
            return 1 if t.has_switch else 0
        if self.selector == DATES_BOX:
            return 1 if t.has_dates else 0
        return 1

    def is_checked(self):
        return self.page.pending["active"]

    def input_value(self):
        return self.page.pending["dates"]

    def fill(self, value):
        self.page.pending["dates"] = value

    def click(self, **_):
        if self.selector == SAVE:
            self.page.save_term()


class FakePage:
    """edit-tags.php with pagination, plus the individual term.php screens."""

    def __init__(self, names=SEASON, per_page=PER_PAGE, endless=False):
        self.terms = [Term(100 + i, n) for i, n in enumerate(names)]
        self.per_page, self.endless = per_page, endless
        self.current_term = None
        self.page_no = 1
        self.on_list = True
        self.pending = {}
        self.list_loads = 0
        self.created = []

    # ── navigation ──
    def goto(self, url, **_):
        if "edit-tags.php" in url:
            self.on_list, self.current_term = True, None
            self.page_no = int(url.split("paged=")[1]) if "paged=" in url else 1
            self.list_loads += 1
        elif "term.php" in url:
            tid = url.split("tag_ID=")[1]
            self.current_term = next((t for t in self.terms if t.id == tid), None)
            self.on_list = False
            if self.current_term:
                self.pending = {"active": self.current_term.active, "dates": self.current_term.dates}

    @property
    def page_terms(self):
        if self.endless:  # a list that keeps serving rows and keeps offering a next page
            return self.terms[:self.per_page]
        start = (self.page_no - 1) * self.per_page
        return self.terms[start:start + self.per_page]

    @property
    def has_next_page(self):
        return True if self.endless else self.page_no * self.per_page < len(self.terms)

    # ── playwright surface ──
    def evaluate(self, js, arg=None):
        if arg is not None:
            self.pending["active"] = arg[0]
            return None
        if "row-title" in js:
            return [{"id": t.id, "name": t.name} for t in self.page_terms] if self.on_list else []
        raise AssertionError(f"unexpected evaluate: {js[:40]}")

    def locator(self, selector):
        return FakeLocator(self, selector)

    def fill(self, selector, value):
        if selector == "#tag-name":
            self._new_name = value

    def click(self, selector, **_):
        if selector == "#submit":
            self.terms.append(Term(900 + len(self.created), self._new_name))
            self.created.append(self._new_name)

    def save_term(self):
        t = self.current_term
        t.active, t.dates = self.pending["active"], self.pending["dates"]
        t.saves += 1

    def wait_for_load_state(self, *_a, **_k):
        pass

    def wait_for_timeout(self, _ms):
        pass


def deployer(**kw):
    pg = FakePage(**kw)
    return Deployer(pg, BASE), pg


def by_name(pg, name):
    return next(t for t in pg.terms if t.name == name)


# ── walking the paginated list ───────────────────────────────────────────────

def test_every_term_is_collected_across_the_pages():
    d, pg = deployer()
    assert len(d.term_rows()) == len(SEASON)


def test_the_walk_visits_exactly_as_many_pages_as_exist():
    d, pg = deployer()
    d.term_rows()
    assert pg.list_loads == math.ceil(len(SEASON) / PER_PAGE)


def test_a_single_page_of_terms_is_not_paged_past():
    d, pg = deployer(names=["3M Open", "BMW Championship"])
    assert len(d.term_rows()) == 2
    assert pg.list_loads == 1


def test_a_list_that_always_offers_another_page_still_terminates():
    d, pg = deployer(endless=True)
    d.term_rows()
    assert pg.list_loads == TERM_PAGE_LIMIT


# ── activating and dating ───────────────────────────────────────────────────

def test_a_term_past_the_first_page_is_activated():
    """The regression: TOUR Championship sits on page two and was never opened."""
    d, pg = deployer()
    assert by_name(pg, "TOUR Championship") not in pg.page_terms
    d.set_active_tournament("TOUR Championship", "August 27-30")
    assert by_name(pg, "TOUR Championship").active is True


def test_a_term_past_the_first_page_gets_this_years_dates():
    d, pg = deployer()
    by_name(pg, "TOUR Championship").dates = "August 21-24"  # last season's label
    d.set_active_tournament("TOUR Championship", "August 27-30")
    assert by_name(pg, "TOUR Championship").dates == "August 27-30"


def test_last_weeks_term_is_switched_off_wherever_it_sits():
    d, pg = deployer()
    by_name(pg, "Event 05").active = True   # page one
    by_name(pg, "Event 40").active = True   # page three
    d.set_active_tournament("TOUR Championship", "August 27-30")
    assert [t.name for t in pg.terms if t.active] == ["TOUR Championship"]


def test_a_term_that_already_exists_is_not_created_a_second_time():
    d, pg = deployer()
    d.set_active_tournament("TOUR Championship", "August 27-30")
    assert pg.created == []
    assert [t.name for t in pg.terms].count("TOUR Championship") == 1


def test_an_event_new_to_the_site_is_created_then_activated():
    d, pg = deployer()
    d.set_active_tournament("Procore Championship", "September 10-13")
    assert pg.created == ["Procore Championship"]
    assert by_name(pg, "Procore Championship").active is True


def test_the_lookup_ignores_case_and_spacing():
    d, pg = deployer()
    d.set_active_tournament("tour   championship", "August 27-30")
    assert pg.created == []
    assert by_name(pg, "TOUR Championship").active is True


def test_a_term_already_correct_is_not_rewritten():
    d, pg = deployer()
    tc = by_name(pg, "TOUR Championship")
    tc.active, tc.dates = True, "August 27-30"
    d.set_active_tournament("TOUR Championship", "August 27-30")
    assert tc.saves == 0


def test_terms_without_the_activation_switch_are_skipped():
    d, pg = deployer()
    by_name(pg, "Event 03").has_switch = False
    d.set_active_tournament("TOUR Championship", "August 27-30")
    assert by_name(pg, "Event 03").saves == 0


def test_no_dates_argument_leaves_labels_untouched():
    d, pg = deployer()
    tc = by_name(pg, "TOUR Championship")
    tc.dates = "August 21-24"
    d.set_active_tournament("TOUR Championship", None)
    assert tc.active is True
    assert tc.dates == "August 21-24"


@pytest.mark.parametrize("total", [1, 19, 20, 21, 40, 41, 44])
def test_the_target_is_reached_whatever_the_season_length(total):
    names = [f"Event {i:02d}" for i in range(total - 1)] + ["TOUR Championship"]
    d, pg = deployer(names=names)
    d.set_active_tournament("TOUR Championship", "August 27-30")
    assert by_name(pg, "TOUR Championship").active is True
    assert pg.created == []
