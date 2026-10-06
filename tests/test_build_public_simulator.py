"""The WordPress embed must survive wpautop.

WordPress filters page content through wpautop on every render: a blank line becomes a
paragraph break and a single newline becomes <br/>. A <br/> between the preset buttons
lands inside their CSS grid, occupies a cell, and pushes every button onto its own row —
which is exactly how the simulator looked on an Android phone: four half-width buttons
stacked in a column instead of the 2x2 grid. The embed therefore ships with no newlines
at all, and hides any <br> that still finds its way into the grid.
"""

import re
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "datagolf"))

from build_public_simulator import build_embed  # noqa: E402

PLAYERS = [
    {"name": "Aaron Rai", "ott": 0.3, "app": 0.5, "arg": 0.1, "putt": 0.2,
     "form": 0.4, "hist": 0.1, "pts": 1.2},
    {"name": "Adam Scott", "ott": 0.2, "app": 0.3, "arg": 0.2, "putt": 0.1,
     "form": 0.2, "hist": 0.3, "pts": 1.0},
    {"name": "Scottie Scheffler", "ott": 0.9, "app": 1.4, "arg": 0.4, "putt": 0.3,
     "form": 1.1, "hist": 0.8, "pts": 3.1},
]


@pytest.fixture(scope="module")
def embed():
    return build_embed(PLAYERS)


# ── nothing for wpautop to rewrite ───────────────────────────────────────────

def test_the_embed_contains_no_newline_for_wpautop_to_turn_into_a_br(embed):
    assert "\n" not in embed


def test_the_embed_ships_no_br_of_its_own(embed):
    assert "<br" not in embed.lower()


def test_the_preset_buttons_are_adjacent_cells_of_one_grid(embed):
    presets = re.search(r'<div class="presets">(.*?)</div>', embed, re.S).group(1)
    assert re.fullmatch(r"\s*(<button data-preset=\"\w+\">[^<]+</button>\s*){4}", presets)


# ── and a br that arrives anyway cannot become a grid cell ───────────────────

def test_a_br_that_still_gets_injected_is_kept_out_of_the_grid(embed):
    """display:none removes an element from grid layout entirely."""
    assert "#sc-sim .presets br{display:none!important}" in embed


# ── the layout rules the theme must not beat ─────────────────────────────────

def test_the_presets_are_a_four_column_grid_two_on_phones(embed):
    assert "#sc-sim .presets{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))" in embed
    assert re.search(r"@media \(max-width:640px\)\{#sc-sim \.presets\{"
                     r"grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important\}\}", embed)


# ── the rest of the embed still holds together ───────────────────────────────

def test_the_default_matchup_is_the_first_two_field_players(embed):
    assert re.search(r'id="p1"[^>]*value="Aaron Rai"', embed)
    assert re.search(r'id="p2"[^>]*value="Adam Scott"', embed)


def test_every_player_travels_in_the_embedded_json(embed):
    import json
    data = json.loads(re.search(r'id="embedded-data">(.*?)</script>', embed).group(1))
    assert [p["name"] for p in data] == ["Aaron Rai", "Adam Scott", "Scottie Scheffler"]


def test_the_widget_script_is_base64_so_wpautop_cannot_touch_it_either(embed):
    assert re.search(r'<script>eval\(atob\("[A-Za-z0-9+/=]+"\)\);</script>', embed)
