#!/usr/bin/env python3
"""
Load step: Data Golf CSVs -> WordPress custom post type (dg_player) via the REST API.

Upserts one post per golfer, keyed on a deterministic slug `dg-<dg_id>`, so re-runs
update existing records instead of creating duplicates. Merges columns from every
available CSV (players, rankings, predictions, skill ratings) into each golfer's meta.

Requires the StatCaddy Golf Data plugin (wordpress/statcaddy-golf-data/) to be active
so the dg_player CPT and its meta fields exist and are REST-writable.

Environment:
    WP_URL           e.g. https://statcaddygolf.com
    WP_USERNAME      WordPress username
    WP_APP_PASSWORD  Application Password (Users -> Profile -> Application Passwords)

Usage:
    python datagolf/load_wordpress.py --data-dir datagolf/data
    python datagolf/load_wordpress.py --post-type-base dg_players --dry-run
"""

import argparse
import os
import sys

import pandas as pd
import requests

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

# Meta fields the plugin registers; only these are pushed to WordPress.
META_FIELDS = [
    "dg_id", "country", "datagolf_rank", "owgr_rank", "dg_skill_estimate",
    "win", "top_5", "top_10", "top_20", "make_cut",
    "sg_total", "sg_ott", "sg_app", "sg_arg", "sg_putt",
    "event_name",
]

# CSVs merged into the golfer record, in priority order (later files fill gaps).
SOURCE_FILES = [
    "dg_players.csv",
    "dg_rankings.csv",
    "dg_skill_ratings.csv",
    "dg_predictions.csv",
]


def build_golfers(data_dir: str) -> pd.DataFrame:
    """Merge all available CSVs into one row per dg_id."""
    merged = None
    latest_update = None
    for filename in SOURCE_FILES:
        path = os.path.join(data_dir, filename)
        if not os.path.exists(path):
            continue
        df = pd.read_csv(path)
        if "dg_id" not in df.columns:
            continue
        if "updated_at" in df.columns:
            latest_update = df["updated_at"].max()
            df = df.drop(columns=["updated_at"])
        if merged is None:
            merged = df
        else:
            new_cols = [c for c in df.columns if c not in merged.columns or c == "dg_id"]
            merged = merged.merge(df[new_cols], on="dg_id", how="outer")
    if merged is None:
        raise SystemExit(f"No usable CSVs with a dg_id column found in {data_dir}")
    merged["dg_updated_at"] = latest_update or ""
    return merged


def player_display_name(row: pd.Series) -> str:
    """Data Golf names are 'Last, First'; render as 'First Last' for the title."""
    name = str(row.get("player_name", "")).strip()
    if "," in name:
        last, first = [part.strip() for part in name.split(",", 1)]
        return f"{first} {last}".strip()
    return name or f"Golfer {row.get('dg_id')}"


def clean_meta(row: pd.Series) -> dict:
    meta = {}
    for field in META_FIELDS + ["dg_updated_at"]:
        if field not in row:
            continue
        value = row[field]
        if pd.isna(value):
            continue
        if field == "dg_id" or field.endswith("_rank"):
            meta[field] = int(value)
        else:
            meta[field] = value.item() if hasattr(value, "item") else value
    return meta


class WordPressClient:
    def __init__(self, base_url: str, username: str, app_password: str, rest_base: str):
        self.api = f"{base_url.rstrip('/')}/wp-json/wp/v2/{rest_base}"
        self.session = requests.Session()
        self.session.auth = (username, app_password.replace(" ", ""))
        self.session.headers["Content-Type"] = "application/json"

    def find_by_slug(self, slug: str):
        resp = self.session.get(self.api, params={"slug": slug, "status": "any"}, timeout=30)
        resp.raise_for_status()
        results = resp.json()
        return results[0]["id"] if results else None

    def create(self, payload: dict) -> int:
        resp = self.session.post(self.api, json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json()["id"]

    def update(self, post_id: int, payload: dict) -> int:
        resp = self.session.post(f"{self.api}/{post_id}", json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json()["id"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Upsert Data Golf CSVs into WordPress.")
    parser.add_argument("--data-dir", default=os.path.join(os.path.dirname(__file__), "data"))
    parser.add_argument("--post-type-base", default="dg_players", help="CPT REST base.")
    parser.add_argument("--dry-run", action="store_true", help="Build records but don't write to WP.")
    args = parser.parse_args()

    for var in ("WP_URL", "WP_USERNAME", "WP_APP_PASSWORD"):
        if not args.dry_run and not os.environ.get(var):
            print(f"ERROR: {var} environment variable is not set.", file=sys.stderr)
            return 2

    golfers = build_golfers(args.data_dir)
    print(f"Prepared {len(golfers)} golfer record(s) from {args.data_dir}")

    if args.dry_run:
        print(golfers.head(10).to_string())
        return 0

    client = WordPressClient(
        os.environ["WP_URL"], os.environ["WP_USERNAME"],
        os.environ["WP_APP_PASSWORD"], args.post_type_base,
    )

    created = updated = failed = 0
    for _, row in golfers.iterrows():
        dg_id = row.get("dg_id")
        if pd.isna(dg_id):
            continue
        slug = f"dg-{int(dg_id)}"
        payload = {
            "title": player_display_name(row),
            "slug": slug,
            "status": "publish",
            "meta": clean_meta(row),
        }
        try:
            existing = client.find_by_slug(slug)
            if existing:
                client.update(existing, payload)
                updated += 1
            else:
                client.create(payload)
                created += 1
        except requests.RequestException as err:
            failed += 1
            detail = err.response.text[:200] if err.response is not None else str(err)
            print(f"[fail] dg_id={dg_id}: {detail}", file=sys.stderr)

    print(f"Done: {created} created, {updated} updated, {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
