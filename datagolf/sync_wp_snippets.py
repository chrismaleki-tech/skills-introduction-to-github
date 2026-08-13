#!/usr/bin/env python3
"""Keep live WordPress Code Snippets in sync with wordpress/snippets/.

The live site (statcaddygolf.com) runs custom PHP/CSS/JS through the Code
Snippets plugin. Those snippets are production code, so their source of truth
lives in this repo: one PHP file per snippet under `wordpress/snippets/`,
mapped to live snippet ids by `wordpress/snippets/manifest.json`.

Commands:
    pull   copy live snippet code into the repo files (use after intentional
           live edits, then commit the diff)
    push   upload repo files to the live snippets (skips snippets that already
           match; refuses nothing — review your diff before running)
    check  exit 1 when live code differs from the repo, a tracked snippet's
           active state changed, or an ACTIVE live snippet is not tracked at
           all (that is how untracked hotfixes sneak in)

Repo files start with `<?php` so editors and linters treat them as PHP; the
Code Snippets plugin stores code without it, so the opener is stripped on push
and re-added on pull.

Env: WP_URL, WP_USERNAME, WP_APP_PASSWORD

Usage:
    python datagolf/sync_wp_snippets.py check
    python datagolf/sync_wp_snippets.py pull [--ids 9,10]
    python datagolf/sync_wp_snippets.py push [--ids 9,10]
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNIPPET_DIR = os.path.join(REPO_ROOT, "wordpress", "snippets")
MANIFEST = os.path.join(SNIPPET_DIR, "manifest.json")
CTX = ssl.create_default_context()


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


def load_manifest() -> list:
    with open(MANIFEST) as f:
        return json.load(f)


def repo_code(entry: dict) -> str:
    path = os.path.join(SNIPPET_DIR, entry["file"])
    if not os.path.exists(path):
        return ""  # not imported yet — a fresh `pull` creates the file
    with open(path) as f:
        code = f.read()
    if code.startswith("<?php"):
        code = code.split("\n", 1)[1] if "\n" in code else ""
    return code.strip("\n")


def write_repo_file(entry: dict, code: str) -> None:
    path = os.path.join(SNIPPET_DIR, entry["file"])
    with open(path, "w") as f:
        f.write("<?php\n" + code.strip("\n") + "\n")


def live_by_id() -> dict:
    return {s["id"]: s for s in api("GET", "/code-snippets/v1/snippets")}


def selected(entries: list, ids_arg: str) -> list:
    if not ids_arg:
        return entries
    wanted = {int(i) for i in ids_arg.split(",")}
    return [e for e in entries if e["id"] in wanted]


def cmd_pull(args) -> int:
    live = live_by_id()
    for entry in selected(load_manifest(), args.ids):
        snippet = live.get(entry["id"])
        if not snippet:
            print(f"[FAIL] snippet {entry['id']} ({entry['file']}) missing on live site")
            return 1
        code = (snippet.get("code") or "").strip("\n")
        if repo_code(entry) == code:
            print(f"[ok] {entry['file']}: already matches live snippet {entry['id']}")
            continue
        write_repo_file(entry, code)
        print(f"[ok] {entry['file']}: updated from live snippet {entry['id']} — review and commit the diff")
    return 0


def cmd_push(args) -> int:
    live = live_by_id()
    for entry in selected(load_manifest(), args.ids):
        snippet = live.get(entry["id"])
        if not snippet:
            print(f"[FAIL] snippet {entry['id']} ({entry['file']}) missing on live site")
            return 1
        code = repo_code(entry)
        if (snippet.get("code") or "").strip("\n") == code and bool(snippet.get("active")) == entry["active"]:
            print(f"[ok] snippet {entry['id']}: already matches {entry['file']}")
            continue
        res = api(
            "PUT",
            f"/code-snippets/v1/snippets/{entry['id']}",
            {
                "name": entry.get("name") or snippet.get("name"),
                "desc": snippet.get("desc"),
                "code": code,
                "scope": entry.get("scope") or snippet.get("scope") or "global",
                "active": entry["active"],
                "priority": entry.get("priority", snippet.get("priority") or 10),
                "tags": snippet.get("tags") or [],
            },
        )
        print(f"[ok] snippet {entry['id']}: pushed {entry['file']} (active={res.get('active')}, "
              f"modified={res.get('modified')})")
    print("[note] purge the page cache if these snippets affect page output "
          "(python datagolf/fix_player_card_headshots_live.py --purge)")
    return 0


def cmd_check(_args) -> int:
    live = live_by_id()
    manifest = load_manifest()
    tracked_ids = {e["id"] for e in manifest}
    problems = 0

    for entry in manifest:
        snippet = live.get(entry["id"])
        if not snippet:
            print(f"[FAIL] snippet {entry['id']} ({entry['file']}) missing on live site")
            problems += 1
            continue
        if (snippet.get("code") or "").strip("\n") != repo_code(entry):
            print(f"[FAIL] snippet {entry['id']} ({entry['file']}) drifted from the repo — "
                  f"live modified {snippet.get('modified')}; run `pull` to import or `push` to restore")
            problems += 1
        elif bool(snippet.get("active")) != entry["active"]:
            print(f"[FAIL] snippet {entry['id']} ({entry['file']}) active={snippet.get('active')} "
                  f"but manifest expects {entry['active']}")
            problems += 1
        else:
            print(f"[ok] snippet {entry['id']} ({entry['file']}) matches live (active={entry['active']})")

    for sid, snippet in sorted(live.items()):
        if snippet.get("active") and sid not in tracked_ids:
            print(f"[FAIL] ACTIVE live snippet {sid} {snippet.get('name')!r} is not tracked in "
                  f"wordpress/snippets/manifest.json — import it with `pull` after adding a manifest entry")
            problems += 1

    if problems:
        print(f"\nDRIFT: {problems} problem(s) — the live site and wordpress/snippets/ disagree.")
        return 1
    print("\nIN SYNC: every tracked snippet matches live and all active live snippets are tracked.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("pull", cmd_pull), ("push", cmd_push), ("check", cmd_check)):
        p = sub.add_parser(name)
        p.add_argument("--ids", default="", help="Comma-separated snippet ids (default: all tracked).")
        p.set_defaults(fn=fn)
    args = ap.parse_args()

    for var in ("WP_URL", "WP_USERNAME", "WP_APP_PASSWORD"):
        if not os.environ.get(var):
            print(f"ERROR: {var} not set", file=sys.stderr)
            return 2
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
