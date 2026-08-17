#!/usr/bin/env python3
"""Repair the simulator player cards on the live site.

The 1v1 and multi-player simulators show each golfer's portrait through a slick
slider: every field player is a `.player-container` slide, slick lays the slides
out in one very wide `.slick-track` row and `.slick-list` clips that row down to
the single visible frame. Slick owns the track and slide widths (it writes them
inline) and moves the selected slide into the frame with a negative `left`.

Recent layout snippets clamped `.slick-track`, `.slick-slide` and
`.player-container` to `width:100%!important`. That makes every slide as wide as
the frame, so the floated row wraps into a vertical stack and only the *first*
slide stays inside the clipped window: card 1 (first field player) still had a
portrait while card 2 — and any other selection — rendered as an empty frame.

This script removes those clamps from the live Code Snippets, keeping the
portrait framing rules that only target `.player-image` and its `<img>`:

  snippet  9  StatCaddy simulator switcher dropdown   (phone media query)
  snippet 10  StatCaddy block same-player matchups    (layout CSS + jQuery)
  snippet 12  StatCaddy standardize player headshots  (rewritten from this repo)

Env: WP_URL, WP_USERNAME, WP_APP_PASSWORD  (+ WP_PASSWORD for --purge)

Usage:
    python datagolf/fix_player_card_headshots_live.py            # patch + verify
    python datagolf/fix_player_card_headshots_live.py --purge    # also purge page cache
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request

REPO_DIR = os.path.dirname(os.path.abspath(__file__))
HEADSHOT_SNIPPET = os.path.join(
    os.path.dirname(REPO_DIR), "wordpress", "snippets", "standardize-player-headshots.php"
)
CTX = ssl.create_default_context()

# Selectors slick sizes itself — a width/max-width clamp on any of these breaks
# the slider layout, so the live snippets must never mention them in a width rule.
SLICK_OWNED = (".slick-track", ".slick-slide", ".player-container")

# --- snippet 9: phone-only clamp block -------------------------------------
S9_OLD = """  .page-id-166 .player-slider-container,.page-id-3736 .player-slider-container,
  .page-id-166 .slick-list,.page-id-3736 .slick-list,
  .page-id-166 .slick-slide,.page-id-3736 .slick-slide,
  .page-id-166 .player-container,.page-id-3736 .player-container,
  .page-id-166 .player-image,.page-id-3736 .player-image{
    max-width:100%!important;width:100%!important;box-sizing:border-box!important}"""
S9_NEW = """  .page-id-166 .player-slider-container,.page-id-3736 .player-slider-container,
  .page-id-166 .slick-list,.page-id-3736 .slick-list,
  .page-id-166 .player-image,.page-id-3736 .player-image{
    max-width:100%!important;width:100%!important;box-sizing:border-box!important}"""

# --- snippet 10: layout CSS + the jQuery that re-applies it ----------------
S10_TRACK_OLD = """#player-comparisons .slick-track,
#player-comparisons-multiple .slick-track{
  max-width:100%!important;
}
"""
S10_TRACK_NEW = ""

S10_SLIDE_OLD = """#player-comparisons .slick-slide,
#player-comparisons .player-container,
#player-comparisons .player-image,
#player-comparisons-multiple .slick-slide,
#player-comparisons-multiple .player-container,
#player-comparisons-multiple .player-image{"""
S10_SLIDE_NEW = """#player-comparisons .player-image,
#player-comparisons-multiple .player-image{"""

S10_JS_OLD = (
    "$s.find('.slick-slide, .player-container, .player-image')"
    ".css({width: '100%', maxWidth: '100%', boxSizing: 'border-box'});"
)
S10_JS_NEW = (
    "$s.find('.player-image')"
    ".css({width: '100%', maxWidth: '100%', boxSizing: 'border-box'});"
)


def api(method: str, path: str, payload: dict | None = None, retries: int = 5):
    url = os.environ["WP_URL"].rstrip("/") + "/wp-json" + path
    auth = base64.b64encode(
        f"{os.environ['WP_USERNAME']}:{os.environ['WP_APP_PASSWORD'].replace(' ', '')}".encode()
    ).decode()
    headers = {
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    data = None if payload is None else json.dumps(payload).encode()
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            print(f"[warn] HTTP {e.code} on {method} {path}: {e.read()[:200]!r}")
        except Exception as e:  # noqa: BLE001 - network flake
            print(f"[warn] {type(e).__name__} on {method} {path}: {e}")
        time.sleep(3 + 3 * attempt)
    raise RuntimeError(f"failed {method} {path}")


def save(snippet: dict, code: str) -> None:
    res = api(
        "PUT",
        f"/code-snippets/v1/snippets/{snippet['id']}",
        {
            "name": snippet.get("name"),
            "desc": snippet.get("desc"),
            "code": code,
            "scope": snippet.get("scope") or "global",
            "active": True,
            "priority": snippet.get("priority") or 10,
            "tags": snippet.get("tags") or [],
        },
    )
    print(f"[ok] snippet {snippet['id']} saved (active={res.get('active')}, modified={res.get('modified')})")


def replace(code: str, old: str, new: str, label: str) -> str:
    if old in code:
        print(f"[ok] {label}: clamp removed")
        return code.replace(old, new)
    if new in code:
        print(f"[skip] {label}: already patched")
        return code
    raise SystemExit(f"ERROR: {label}: expected block not found — inspect the live snippet before retrying")


def width_clamped_selectors(code: str) -> list:
    """Return slick-owned classes that a width rule still targets directly.

    Only the rule's subject counts: `.player-container .player-image{width:…}`
    sizes the portrait, which is fine, while `.player-container{width:…}` sizes
    the slide itself, which breaks the slider.
    """
    body = re.sub(r"/\*.*?\*/", "", code, flags=re.S)
    hits = []
    for match in re.finditer(r"([^{}();]+)\{([^{}]*)\}", body):
        selectors, decls = match.group(1), match.group(2)
        if not re.search(r"(^|[;\s])(max-)?width\s*:", decls):
            continue
        for selector in selectors.split(","):
            subject = selector.strip().split()[-1] if selector.strip() else ""
            for sel in SLICK_OWNED:
                if sel in subject and sel not in hits:
                    hits.append(sel)
    return hits


def patch_snippet_9() -> None:
    s = api("GET", "/code-snippets/v1/snippets/9")
    code = replace(s.get("code") or "", S9_OLD, S9_NEW, "snippet 9 phone clamp")
    if code != s.get("code"):
        save(s, code)


def patch_snippet_10() -> None:
    s = api("GET", "/code-snippets/v1/snippets/10")
    code = s.get("code") or ""
    code = replace(code, S10_TRACK_OLD, S10_TRACK_NEW, "snippet 10 .slick-track clamp")
    code = replace(code, S10_SLIDE_OLD, S10_SLIDE_NEW, "snippet 10 slide clamp")
    code = replace(code, S10_JS_OLD, S10_JS_NEW, "snippet 10 constrainSliders() slide widths")
    if code != (s.get("code") or ""):
        save(s, code)


def patch_snippet_12() -> None:
    s = api("GET", "/code-snippets/v1/snippets/12")
    wanted = open(HEADSHOT_SNIPPET).read()
    if wanted.startswith("<?php"):
        wanted = wanted.split("\n", 1)[1].lstrip("\n")
    if (s.get("code") or "").strip() == wanted.strip():
        print("[skip] snippet 12: already matches wordpress/snippets/standardize-player-headshots.php")
        return
    print("[ok] snippet 12: rewritten from wordpress/snippets/standardize-player-headshots.php")
    save(s, wanted)


def verify() -> int:
    bad = 0
    for sid in (9, 10, 12):
        code = api("GET", f"/code-snippets/v1/snippets/{sid}").get("code") or ""
        hits = width_clamped_selectors(code)
        if hits:
            print(f"[FAIL] snippet {sid} still sizes slick-owned selectors: {', '.join(hits)}")
            bad += 1
        else:
            print(f"[ok] snippet {sid}: no width rules on {', '.join(SLICK_OWNED)}")
    return bad


def purge_cache() -> None:
    from playwright.sync_api import sync_playwright

    base = os.environ["WP_URL"].rstrip("/")
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_context(viewport={"width": 1400, "height": 900}).new_page()
        pg.goto(f"{base}/golflogin", wait_until="domcontentloaded")
        pg.fill("#user_login", os.environ["WP_USERNAME"])
        pg.fill("#user_pass", os.environ["WP_PASSWORD"])
        pg.click("#wp-submit")
        pg.wait_for_load_state("networkidle")
        pg.goto(f"{base}/wp-admin/", wait_until="networkidle")
        link = pg.locator(
            "#wp-admin-bar-SG_CachePress_Supercacher_Purge a, #wp-admin-bar-sg-cachepress-purge a"
        ).first
        if link.count():
            link.click()
            pg.wait_for_load_state("networkidle")
            pg.wait_for_timeout(3000)
            print("[ok] page cache purged")
        else:
            print("[warn] cache purge control not found — skipping")
        b.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--purge", action="store_true", help="Purge the page cache after patching.")
    args = ap.parse_args()

    for var in ("WP_URL", "WP_USERNAME", "WP_APP_PASSWORD"):
        if not os.environ.get(var):
            print(f"ERROR: {var} not set", file=sys.stderr)
            return 2

    patch_snippet_9()
    patch_snippet_10()
    patch_snippet_12()
    bad = verify()
    if args.purge and not bad:
        purge_cache()
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
