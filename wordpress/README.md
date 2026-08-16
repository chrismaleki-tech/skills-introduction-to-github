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

# Code Snippets (`wordpress/snippets/`)

The live site runs its custom CSS/PHP through the **Code Snippets** plugin
rather than through theme files, because the `stat-caddy` theme is not in this
repo. Those snippets are production code, so each one is kept here as a PHP
file and mapped to its live snippet id by `wordpress/snippets/manifest.json`.

- `simulator-button-colors.php` (live snippet 13) — puts every simulator
  call-to-action on the Try Simulator colour scheme: a `#48911E` fill with a
  white label that inverts to a white fill with a green label on hover. It
  covers the theme's `.green-button` ("Run the simulation" / "Run the
  simulations"), the Elementor buttons the two simulators link to each other
  with, and the hover label of the Try Simulator buttons.

To change a snippet, edit the repo file and PUT it to
`/wp-json/code-snippets/v1/snippets/<id>` (`WP_USERNAME` + `WP_APP_PASSWORD`),
then purge the SiteGround cache from the admin bar and check the result as a
logged-out visitor — logged-in admins bypass the page cache.
