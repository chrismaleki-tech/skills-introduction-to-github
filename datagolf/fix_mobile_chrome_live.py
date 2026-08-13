#!/usr/bin/env python3
"""Patch live WordPress Code Snippet #9 for phone-safe simulator chrome.

Reduces the oversized top gap on Android, makes the header title wrap, stacks
1v1 player cards on narrow viewports (overrides theme max-width:45%!important),
and keeps native <select> player pickers full-width / 16px on phones.
"""

from __future__ import annotations

import base64
import json
import os
import ssl
import time
import urllib.error
import urllib.request

WP_URL = os.environ["WP_URL"].rstrip("/")
USER = os.environ["WP_USERNAME"]
APP = os.environ["WP_APP_PASSWORD"].replace(" ", "")
CTX = ssl.create_default_context()
AUTH = f"Basic {base64.b64encode(f'{USER}:{APP}'.encode()).decode()}"
HEADERS = {
    "Authorization": AUTH,
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# Marked block — replaced idempotently on each run.
MARKER_BEGIN = "/*sc-mobile-chrome-begin*/"
MARKER_END = "/*sc-mobile-chrome-end*/"

MOBILE_CHROME_CSS = f"""{MARKER_BEGIN}
@media (max-width:782px){{
.sc-more-sims{{margin:64px auto 10px!important;padding:8px 12px!important}}
.page-id-4952 .sc-header-matchup-title,.page-id-166 .sc-header-matchup-title,.page-id-3736 .sc-header-matchup-title{{
white-space:normal!important;font-size:clamp(14px,4vw,22px)!important;
max-width:min(52vw,220px)!important;letter-spacing:.5px!important;line-height:1.05!important;
overflow-wrap:anywhere!important;hyphens:auto!important}}
.page-id-166 #player-comparisons .player-comparison-container.row,
.page-id-3736 #player-comparisons-multiple .player-comparison-container.row,
.page-id-166 .player-comparison-container.row.justify-content-between,
.page-id-3736 .player-comparison-container.row.justify-content-between{{
display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;
align-items:stretch!important;gap:18px!important}}
.page-id-166 #player-comparisons #player1-outer.players-outer-container,
.page-id-166 #player-comparisons #player2-outer.players-outer-container,
.page-id-166 #player-comparisons .players-outer-container,
.page-id-3736 #player-comparisons-multiple #player1-outer.players-outer-container,
.page-id-3736 #player-comparisons-multiple #player2-outer.players-outer-container,
.page-id-3736 #player-comparisons-multiple .players-outer-container{{
flex:0 0 auto!important;max-width:100%!important;width:100%!important;
float:none!important;padding-left:0!important;padding-right:0!important;margin-left:auto!important;margin-right:auto!important}}
.page-id-166 #player-comparisons .player-select,
.page-id-166 #player-comparisons select.player-select,
.page-id-166 #player-comparisons .select2-container,
.page-id-3736 #player-comparisons-multiple .player-select,
.page-id-3736 #player-comparisons-multiple select.player-select,
.page-id-3736 #player-comparisons-multiple .select2-container{{
max-width:100%!important;width:100%!important;box-sizing:border-box!important;font-size:16px!important}}
.page-id-166 #player-comparisons .select2-container .select2-selection--single,
.page-id-3736 #player-comparisons-multiple .select2-container .select2-selection--single{{
min-height:44px!important}}
.page-id-166 #player-comparisons button,
.page-id-3736 #player-comparisons-multiple button,
.page-id-166 #player-comparisons .green-button,
.page-id-3736 #player-comparisons-multiple .green-button{{
max-width:100%!important;box-sizing:border-box!important;white-space:normal!important;
min-height:44px!important}}
}}
{MARKER_END}"""


def api(method: str, path: str, payload: dict | None = None, retries: int = 6):
    data = None if payload is None else json.dumps(payload).encode()
    for i in range(retries):
        req = urllib.request.Request(
            f"{WP_URL}/wp-json{path}",
            data=data,
            headers=HEADERS,
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
                body = r.read()
                if body[:1] == b"<":
                    print(f"[warn] captcha on {method} {path}; retry {i + 1}/{retries}")
                    time.sleep(3 + i * 3)
                    continue
                return json.loads(body.decode())
        except urllib.error.HTTPError as e:
            err = e.read()[:300]
            print(f"[warn] HTTP {e.code} on {method} {path}: {err!r}; retry {i + 1}/{retries}")
            time.sleep(3 + i * 3)
        except Exception as e:  # noqa: BLE001
            print(f"[warn] {type(e).__name__} on {method} {path}: {e}; retry {i + 1}/{retries}")
            time.sleep(3 + i * 3)
    raise RuntimeError(f"Failed {method} {path}")


def upsert_marked_css(code: str) -> str:
    """Insert or replace the marked mobile-chrome CSS block inside the snippet."""
    if MARKER_BEGIN in code and MARKER_END in code:
        start = code.index(MARKER_BEGIN)
        end = code.index(MARKER_END) + len(MARKER_END)
        updated = code[:start] + MOBILE_CHROME_CSS + code[end:]
        print("[ok] replaced marked mobile-chrome CSS block")
        return updated

    # Prefer injecting just before the closing </style> of the sc_more_sims CSS echo.
    needle = "    . '</style>';"
    if needle in code:
        # Insert as a PHP string concat before the closing style tag.
        injection = (
            "    . '" + MOBILE_CHROME_CSS.replace("\\", "\\\\").replace("'", "\\'") + "'\n"
            + needle
        )
        updated = code.replace(needle, injection, 1)
        print("[ok] injected marked mobile-chrome CSS before </style>")
        return updated

    # Fallback: append a second wp_head style printer.
    appendix = (
        "\nadd_action('wp_head', function () {\n"
        "    if (!is_page([166, 3736, 4952, 1738])) return;\n"
        "    echo '<style id=\"sc-mobile-chrome\">'\n"
        "    . '" + MOBILE_CHROME_CSS.replace("\\", "\\\\").replace("'", "\\'") + "'\n"
        "    . '</style>';\n"
        "}, 99);\n"
    )
    print("[ok] appended secondary wp_head mobile-chrome style")
    return code + appendix


def patch_bump_js(code: str) -> str:
    """Keep the phone hard-cap on .sc-more-sims margin-top."""
    updated = code
    replacements = [
        (
            'function bump(){var isPhone=window.matchMedia("(max-width:782px)").matches;if(isPhone){w.style.setProperty("margin-top","64px","important");return;}',
            'function bump(){var isPhone=window.matchMedia("(max-width:782px)").matches;if(isPhone){w.style.setProperty("margin-top","64px","important");return;}',
        ),
    ]
    # If the early-return phone cap is missing, try to install it.
    if 'if(isPhone){w.style.setProperty("margin-top","64px","important");return;}' not in updated:
        old = 'function bump(){'
        # Only the JS string form inside PHP concat
        old_js = ". 'function bump(){'"
        new_js = (
            '. \'function bump(){var isPhone=window.matchMedia("(max-width:782px)").matches;'
            'if(isPhone){w.style.setProperty("margin-top","64px","important");return;}\''
        )
        if old_js in updated:
            # More careful: find bump function body start in concatenated strings
            target = (
                ". 'function bump(){"
                'if(!w||window.scrollY>8)return;'
            )
            repl = (
                ". 'function bump(){"
                'var isPhone=window.matchMedia("(max-width:782px)").matches;'
                'if(isPhone){w.style.setProperty("margin-top","64px","important");return;}'
                'if(!w||window.scrollY>8)return;'
            )
            if target in updated:
                updated = updated.replace(target, repl, 1)
                print("[ok] installed phone margin-top hard-cap in bump()")
            else:
                print("[warn] bump() pattern not found for hard-cap install")
        else:
            print("[warn] bump() string not found")
    else:
        print("[ok] phone margin-top hard-cap already present")

    for old, new in replacements:
        if old != new and old in updated:
            updated = updated.replace(old, new)
    return updated


def main() -> int:
    current = api("GET", "/code-snippets/v1/snippets/9")
    code = current.get("code") or ""
    if not code:
        print("ERROR: snippet 9 empty/missing")
        return 1
    updated = upsert_marked_css(code)
    updated = patch_bump_js(updated)
    if updated == code:
        print("[ok] snippet 9 already patched")
        return 0
    res = api(
        "PUT",
        "/code-snippets/v1/snippets/9",
        {
            "name": current.get("name") or "StatCaddy simulator switcher dropdown",
            "desc": 'Top-of-page "Simulators" picklist; phone-safe clearance + stacked 1v1 cards + wrap title.',
            "code": updated,
            "scope": current.get("scope") or "global",
            "active": True,
            "priority": current.get("priority") or 5,
            "tags": current.get("tags") or ["statcaddy", "simulators"],
        },
    )
    print(f"[ok] snippet 9 updated; active={res.get('active')} modified={res.get('modified')}")
    # Confirm markers present
    check = api("GET", "/code-snippets/v1/snippets/9")
    c = check.get("code") or ""
    print(
        "[verify] markers",
        MARKER_BEGIN in c,
        "player-comparisons#player1",
        "#player-comparisons #player1-outer" in c,
        "max-width:100%",
        c.count("max-width:100%!important"),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
