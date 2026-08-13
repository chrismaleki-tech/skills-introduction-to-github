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

## Code Snippets (live site overrides)

Source for WordPress **Code Snippets** used on statcaddygolf.com lives in
`wordpress/snippets/`. Keep these in sync with the active snippets in WP admin.

| File | Snippet name | Purpose |
|---|---|---|
| `snippets/standardize-player-headshots.php` | StatCaddy standardize player headshots | Force consistent headshot framing (`object-fit: cover`, top-center) on 1v1 + multi-player simulators |

### Simulator card CSS rule

The simulator cards show portraits through a slick slider: one
`.player-container` slide per field player, laid out by slick in a single very
wide `.slick-track` row that `.slick-list` clips to one visible frame. Slick
writes the track and slide widths inline and slides the selected player into the
frame with a negative `left`.

Never add a `width` / `max-width` rule for `.slick-track`, `.slick-slide` or
`.player-container`. Clamping them to the frame width wraps the row into a
vertical stack, and every slide except the first one ends up outside the clipped
frame — so a card renders an empty portrait for the golfer it has selected. To
contain the slider on small screens, clip at `.slick-list` (and size
`.player-image` / its `<img>`) instead.

Run `python datagolf/verify_simulator_cards.py --select` after any simulator CSS
change; it fails when a card's selected portrait is not inside its frame.
