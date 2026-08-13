#!/usr/bin/env python3
"""Check that every simulator card shows the portrait of its selected golfer.

Each card is a slick slider holding one slide per field player, clipped to a
single visible frame. If CSS clamps the track or the slides to the frame width
the row wraps into a vertical stack and only the first slide stays inside the
frame, so cards silently render an empty portrait (see
`fix_player_card_headshots_live.py`). This script measures how much of each
card's *current* slide overlaps its frame, at desktop / laptop / phone widths,
and fails when a portrait is not on screen.

Env: WP_URL, WP_USERNAME, WP_PASSWORD

Usage:
    python datagolf/verify_simulator_cards.py
    python datagolf/verify_simulator_cards.py --shots-dir /tmp/shots --select
"""

from __future__ import annotations

import argparse
import json
import os
import sys

VIEWPORTS = (("desktop", 1440, 900), ("laptop", 1024, 800), ("phone", 390, 844))
PAGES = (("1v1", "/matchup-simulator/", "#player-comparisons"),
         ("multi", "/multi-matchup-simulator/", "#player-comparisons-multiple"))
MIN_VISIBLE_PCT = 95

MEASURE = r"""
(rootSel) => {
  const cards = [...document.querySelectorAll(rootSel + ' .players-outer-container:not(.not-active)')];
  return cards.map((card) => {
    const list = card.querySelector('.slick-list');
    const cur = card.querySelector('.slick-slide.slick-current');
    const sel = card.querySelector('select');
    const selected = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : null;
    if (!list || !cur) return {card: card.id, selected, visiblePct: null, note: 'no slider'};
    const lr = list.getBoundingClientRect(), cr = cur.getBoundingClientRect();
    const ow = Math.max(0, Math.min(cr.right, lr.right) - Math.max(cr.left, lr.left));
    const oh = Math.max(0, Math.min(cr.bottom, lr.bottom) - Math.max(cr.top, lr.top));
    const img = cur.querySelector('img');
    return {
      card: card.id,
      selected,
      portrait: img ? (img.alt || img.getAttribute('src').split('/').pop()) : null,
      portraitLoaded: !!(img && img.naturalWidth > 0),
      trackWidth: Math.round(parseFloat(getComputedStyle(card.querySelector('.slick-track')).width)),
      frameWidth: Math.round(lr.width),
      visiblePct: cr.width && cr.height ? Math.round(100 * (ow * oh) / (cr.width * cr.height)) : 0,
    };
  });
}
"""


def pick(pg, card_id: str, needle: str) -> None:
    """Choose a golfer through the real picker so the theme's handlers run."""
    pg.evaluate(
        """([cardId, needle]) => {
             const sel = document.querySelector('#' + cardId + ' select');
             const opt = [...sel.options].find(o => o.text.includes(needle));
             if (!opt) return;
             sel.value = opt.value;
             const $ = window.jQuery;
             if ($ && $(sel).data('select2')) $(sel).trigger('select2:select', {data: {id: opt.value}});
             if ($) $(sel).trigger('change'); else sel.dispatchEvent(new Event('change', {bubbles: true}));
           }""",
        [card_id, needle],
    )
    pg.wait_for_timeout(2500)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--shots-dir", default="", help="Save a screenshot of the cards per page/viewport.")
    ap.add_argument("--tag", default="cards", help="Screenshot filename prefix.")
    ap.add_argument("--select", action="store_true",
                    help="Also switch both 1v1 cards to mid-field golfers and re-check.")
    args = ap.parse_args()

    for var in ("WP_URL", "WP_USERNAME", "WP_PASSWORD"):
        if not os.environ.get(var):
            print(f"ERROR: {var} not set", file=sys.stderr)
            return 2
    if args.shots_dir:
        os.makedirs(args.shots_dir, exist_ok=True)

    from playwright.sync_api import sync_playwright

    base = os.environ["WP_URL"].rstrip("/")
    failures, report = [], {}
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
        pg.goto(f"{base}/golflogin", wait_until="domcontentloaded")
        pg.fill("#user_login", os.environ["WP_USERNAME"])
        pg.fill("#user_pass", os.environ["WP_PASSWORD"])
        pg.click("#wp-submit")
        pg.wait_for_load_state("networkidle")
        if "/wp-admin" not in pg.url:
            print("ERROR: login failed", file=sys.stderr)
            return 2

        for page_name, path, root in PAGES:
            for vp_name, w, h in VIEWPORTS:
                pg.set_viewport_size({"width": w, "height": h})
                pg.goto(f"{base}{path}?scverify={vp_name}", wait_until="networkidle")
                pg.wait_for_timeout(4500)
                cards = pg.evaluate(MEASURE, root)
                key = f"{page_name}/{vp_name}"
                report[key] = cards
                for c in cards:
                    ok = (c.get("visiblePct") or 0) >= MIN_VISIBLE_PCT and c.get("portraitLoaded")
                    print(f"{'ok  ' if ok else 'FAIL'} {key:<16} {c['card']:<14} "
                          f"{str(c.get('selected')):<22} portrait={str(c.get('portrait'))[:28]:<30} "
                          f"visible={c.get('visiblePct')}% track={c.get('trackWidth')} frame={c.get('frameWidth')}")
                    if not ok:
                        failures.append(f"{key} {c['card']}")
                if args.shots_dir:
                    pg.locator(root).screenshot(path=f"{args.shots_dir}/{args.tag}_{page_name}_{vp_name}.png")

        if args.select:
            pg.set_viewport_size({"width": 1440, "height": 900})
            pg.goto(f"{base}/matchup-simulator/?scverify=select", wait_until="networkidle")
            pg.wait_for_timeout(4500)
            pick(pg, "player1-outer", "Scottie Scheffler")
            pick(pg, "player2-outer", "Rory McIlroy")
            cards = pg.evaluate(MEASURE, "#player-comparisons")
            report["1v1/after-select"] = cards
            for c in cards:
                ok = (c.get("visiblePct") or 0) >= MIN_VISIBLE_PCT and c.get("portraitLoaded") \
                     and (c.get("selected") or "").split()[-1] in str(c.get("portrait"))
                print(f"{'ok  ' if ok else 'FAIL'} {'1v1/after-select':<16} {c['card']:<14} "
                      f"{str(c.get('selected')):<22} portrait={str(c.get('portrait'))[:28]:<30} "
                      f"visible={c.get('visiblePct')}%")
                if not ok:
                    failures.append(f"1v1/after-select {c['card']}")
            if args.shots_dir:
                pg.locator("#player-comparisons").screenshot(
                    path=f"{args.shots_dir}/{args.tag}_1v1_after_select.png")
        b.close()

    if args.shots_dir:
        open(f"{args.shots_dir}/{args.tag}_report.json", "w").write(json.dumps(report, indent=1))
    if failures:
        print(f"\nFAILED: {len(failures)} card(s) not showing a portrait: {', '.join(failures)}")
        return 1
    print("\nPASS: every card shows its selected golfer's portrait.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
