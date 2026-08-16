# StatCaddy Golf Data (WordPress plugin)

A small must-use-style plugin that registers the `dg_player` custom post type
("Golfers") and its Data Golf meta fields, exposed in the REST API so the
pipeline's load step (`datagolf/load_wordpress.py`) can upsert golfer records.

## Why a custom post type (not WooCommerce products)

statcaddygolf.com sells a single membership subscription (via WooCommerce
Subscriptions + Stripe). The golf data is membership-gated *content*, not
things to sell, so it belongs in its own post type that members view — while
WooCommerce keeps handling the selling of access. Elementor Pro (already active
on the site) can render the `dg_player` records with a Loop Grid, and ACF Pro
(also active) can be pointed at the same meta fields for editing/display.

## Install

1. In this repo, zip the plugin folder (already produced as
   `wordpress/statcaddy-golf-data.zip`, or rebuild with
   `cd wordpress && zip -r statcaddy-golf-data.zip statcaddy-golf-data`).
2. In WP admin: **Plugins -> Add New -> Upload Plugin**, choose the zip, install,
   and **Activate**.
3. Confirm it worked: `GET /wp-json/wp/v2/dg_players` should return `200` (an
   empty array until the first load), and a **Golfers** menu item appears in the
   admin sidebar.

## What it registers

- Post type `dg_player` (REST base `dg_players`, archive at `/golfers`).
- REST-writable post meta: `dg_id`, `country`, `datagolf_rank`, `owgr_rank`,
  `dg_skill_estimate`, `win`, `top_5`, `top_10`, `top_20`, `make_cut`,
  `sg_total`, `sg_ott`, `sg_app`, `sg_arg`, `sg_putt`, `event_name`,
  `dg_updated_at`.

Meta writes require the `edit_posts` capability, so only authenticated
API users (the pipeline's Application Password user) can modify records.

## Code snippets

`snippets/` holds PHP that runs on the live site through the Code Snippets
plugin rather than through this plugin. Each file is pasted into a snippet of
the same name and activated there.

- `matchup-percentages-total-100.php` — makes the simulator's win percentages
  add up to 100. Each player's share is rounded to a tenth on its own, so a
  three-way can show 99.9 and a six-way 100.2; this moves each leftover tenth
  onto a separate player so the numbers on screen total 100. Head-to-head
  matchups are handled upstream in `datagolf/deploy_simulator.py`, which puts
  the uploaded win counts on a tenth-of-a-percent grid.
  Live as snippet id **14**, "StatCaddy matchup percentages total 100", global
  scope, priority 10, active. To turn it off, deactivate that snippet; the
  simulator falls straight back to its own numbers.

Once `wordpress/snippets/manifest.json` lands, snippet 14 needs an entry so the
drift check tracks it:

```json
{ "id": 14, "file": "matchup-percentages-total-100.php",
  "name": "StatCaddy matchup percentages total 100", "scope": "global", "active": true }
```

Run the snippet tests with:

```
php wordpress/snippets/tests/test-matchup-percentages.php
```
