#!/usr/bin/env python3
"""
Ensure the public /simulator/ page appears in the logged-in Simulators dropdown.

The Logged In Menu (id 25) has a top-level "Simulators" item whose children are
the member-facing tools (1v1, Multi-Player, …). This script upserts a child link
to WordPress page WP_SIMULATOR_PAGE_ID (default 4952, slug /simulator/), using
that page's current title as the menu label.

Env:
  WP_URL, WP_USERNAME, WP_APP_PASSWORD   (required)
  WP_SIMULATOR_PAGE_ID                   (default 4952)
  WP_SIMULATORS_MENU_ID                  (default 25 — Logged In Menu)
  WP_SIMULATORS_PARENT_ITEM_ID           (default 3921 — "Simulators" parent)

Usage:
  python datagolf/ensure_simulator_menu.py
  python datagolf/ensure_simulator_menu.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys

import requests

DEFAULT_PAGE_ID = 4952
DEFAULT_MENU_ID = 25
DEFAULT_PARENT_ITEM_ID = 3921


def _auth():
    for v in ("WP_URL", "WP_USERNAME", "WP_APP_PASSWORD"):
        if not os.environ.get(v):
            raise SystemExit(f"ERROR: {v} not set")
    return (
        os.environ["WP_URL"].rstrip("/"),
        (os.environ["WP_USERNAME"], os.environ["WP_APP_PASSWORD"].replace(" ", "")),
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="Report what would change; no writes.")
    ap.add_argument("--page-id", type=int, default=int(os.environ.get("WP_SIMULATOR_PAGE_ID", DEFAULT_PAGE_ID)))
    ap.add_argument("--menu-id", type=int, default=int(os.environ.get("WP_SIMULATORS_MENU_ID", DEFAULT_MENU_ID)))
    ap.add_argument(
        "--parent-item-id",
        type=int,
        default=int(os.environ.get("WP_SIMULATORS_PARENT_ITEM_ID", DEFAULT_PARENT_ITEM_ID)),
    )
    args = ap.parse_args()

    base, auth = _auth()

    page = requests.get(f"{base}/wp-json/wp/v2/pages/{args.page_id}", auth=auth, params={"context": "edit"}, timeout=30)
    page.raise_for_status()
    pdata = page.json()
    title = pdata["title"].get("raw") or pdata["title"]["rendered"]
    link = pdata["link"]
    print(f"page {args.page_id}: title={title!r} status={pdata['status']} link={link}")

    items = requests.get(
        f"{base}/wp-json/wp/v2/menu-items",
        auth=auth,
        params={"menus": args.menu_id, "per_page": 100, "context": "edit"},
        timeout=30,
    )
    items.raise_for_status()
    menu_items = items.json()

    existing = next(
        (
            it
            for it in menu_items
            if it.get("parent") == args.parent_item_id
            and (
                str(it.get("object_id")) == str(args.page_id)
                or (it.get("url") or "").rstrip("/").endswith("/simulator")
            )
        ),
        None,
    )

    siblings = [it for it in menu_items if it.get("parent") == args.parent_item_id]
    next_order = max((it.get("menu_order") or 0 for it in siblings), default=1) + 1

    if existing:
        need_title = (existing.get("title", {}).get("raw") or existing.get("title", {}).get("rendered")) != title
        need_parent = existing.get("parent") != args.parent_item_id
        if not need_title and not need_parent:
            print(f"[ok] already listed as {title!r} (menu-item {existing['id']})")
            return 0
        payload = {"title": title, "parent": args.parent_item_id, "menus": args.menu_id}
        print(f"would update menu-item {existing['id']}: {payload}" if args.dry_run else f"updating menu-item {existing['id']}")
        if args.dry_run:
            return 0
        r = requests.post(f"{base}/wp-json/wp/v2/menu-items/{existing['id']}", auth=auth, json=payload, timeout=30)
        r.raise_for_status()
        print(f"[ok] updated menu-item {r.json()['id']} -> {r.json().get('url')}")
        return 0

    payload = {
        "title": title,
        "type": "post_type",
        "object": "page",
        "object_id": args.page_id,
        "parent": args.parent_item_id,
        "menus": args.menu_id,
        "status": "publish",
        "menu_order": next_order,
    }
    print(f"would create menu item: {payload}" if args.dry_run else f"creating menu item under parent {args.parent_item_id}")
    if args.dry_run:
        return 0
    r = requests.post(f"{base}/wp-json/wp/v2/menu-items", auth=auth, json=payload, timeout=30)
    r.raise_for_status()
    d = r.json()
    print(f"[ok] created menu-item {d['id']}: {d.get('title', {}).get('rendered')} -> {d.get('url')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
