# Data Golf -> CSV pipeline (extract step)

Pulls data from the [Data Golf API](https://datagolf.com/api-access) and writes
CSV snapshots to `datagolf/data/`. This is the extract/transform stage of the
Data Golf -> statcaddygolf.com pipeline; the WordPress/WooCommerce load stage
consumes these CSVs.

## Prerequisites

- A Data Golf **Scratch Plus** membership API key.
- Python 3.9+ with `requests` and `pandas` (already in the repo's
  `requirements.txt`).

## Setup

Set the API key as an environment variable named `DATAGOLF_KEY`:

- **Locally**: copy `.env.example` to `.env` and fill in `DATAGOLF_KEY=...`
  (the script auto-loads `.env` if `python-dotenv` is installed).
- **GitHub Actions**: add `DATAGOLF_KEY` as a repository secret
  (Settings -> Secrets and variables -> Actions).
- **Cursor Cloud Agents**: add `DATAGOLF_KEY` in the Cursor Dashboard
  (Cloud Agents -> Secrets).

## Usage

```bash
# All datasets (players, rankings, schedule, field, predictions, skill_ratings)
python datagolf/update_csv.py

# A subset, for a specific tour
python datagolf/update_csv.py --datasets rankings,predictions --tour pga
```

Each dataset is written as an atomic snapshot (temp file + rename), so a failed
run never leaves a half-written CSV. Responses are validated (non-empty,
expected columns present) before anything is written. Requests are throttled
and retried to stay under Data Golf's 45 requests/minute limit.

| Dataset | File | Contents |
|---|---|---|
| `players` | `dg_players.csv` | Full player list with `dg_id` (the join key everywhere) |
| `rankings` | `dg_rankings.csv` | Data Golf rankings (top ~500) with skill estimates |
| `schedule` | `dg_schedule.csv` | Season schedule for the selected tour |
| `field` | `dg_field.csv` | Current event field with tee times |
| `predictions` | `dg_predictions.csv` | Pre-tournament win / top-N / make-cut probabilities |
| `skill_ratings` | `dg_skill_ratings.csv` | Strokes-gained skill components per player |

Note: `field` and `predictions` only return data while an event is upcoming or
in progress; off-season runs may report those two as failed, which is expected.

## Full dump: pull everything (`pull_all.py`)

`pull_all.py` hits every Data Golf endpoint the API key's plan can access and
writes one CSV per feed to `datagolf/data/` (nested JSON flattened, top-level
context fields like `event_name`/`last_updated` carried onto each row).

```bash
python datagolf/pull_all.py                 # all current + list feeds -> datagolf/data/
python datagolf/pull_all.py --tour euro     # a different tour
python datagolf/pull_all.py --with-history 3  # + round-level data for 3 recent events (needs historical tier)
```

Feeds written (19 with a standard Scratch Plus key):

- **General**: `dg_players`, `dg_schedule`, `dg_field_updates`
- **Predictions/stats**: `dg_rankings`, `dg_pre_tournament`, `dg_skill_ratings`,
  `dg_approach_skill`, `dg_player_decompositions`, `dg_fantasy_projections`,
  `dg_in_play`, `dg_live_tournament_stats`, `dg_live_strokes_gained`,
  `dg_live_hole_stats`
- **Betting odds**: `dg_outrights_win`, `dg_matchups_all_pairings`
  (`dg_matchups` only when a tournament matchup market is live)
- **Historical indexes**: `dg_hist_raw_event_list`, `dg_hist_results_event_list`,
  `dg_hist_odds_event_list`, `dg_hist_dfs_event_list`

The live feeds (`in_play`, `live_*`) only return rows during an active
tournament. Per-event historical *detail* (round scoring, historical odds, DFS
points) requires the historical-data subscription tier; with a base key those
detail pulls return HTTP 403 and are skipped, but the historical event *lists*
above are still available.

## Load step: CSV -> WordPress (statcaddygolf.com)

`load_wordpress.py` merges the CSVs into one record per golfer (keyed on `dg_id`)
and upserts them into the `dg_player` custom post type on the WordPress site via
the REST API. Re-runs update existing golfers instead of creating duplicates
(the post slug is `dg-<dg_id>`).

Prerequisite: install and activate the **StatCaddy Golf Data** plugin
(`wordpress/statcaddy-golf-data/`) so the `dg_player` post type and its meta
fields exist and are REST-writable. See `wordpress/README.md`.

```bash
# Preview merged records without writing to WordPress
python datagolf/load_wordpress.py --data-dir datagolf/data --dry-run

# Upsert into WordPress (needs WP_URL / WP_USERNAME / WP_APP_PASSWORD)
python datagolf/load_wordpress.py
```

Environment variables:

- `WP_URL` — e.g. `https://statcaddygolf.com`
- `WP_USERNAME` — WordPress username
- `WP_APP_PASSWORD` — Application Password for REST only (Users -> Profile -> Application Passwords)
- `WP_PASSWORD` — real account password for `/golflogin` browser deploys (`deploy_simulator.py` /
  Weekly Simulator Deploy). Application passwords cannot sign into wp-admin.

## Tournament name and dates on the simulator

The label under the tournament name comes from the `tournament_dates` field on the
`tournament` taxonomy term in wp-admin. It is free text, and for most of the 2026
calendar it still held the 2025 dates because nobody re-typed it.

`deploy_simulator.py` now writes it for the event it activates each week, from
`start_date` in the Data Golf schedule — round one, always a Thursday — through the
final round three days later, e.g. `August 20-23`. Only the activated term is
touched, so terms for other weeks keep whatever they already say until their turn
comes round. An event missing from the schedule is left alone with a warning.

## Workbook field sheets (Scottish Open Field / Wyndham Field)

`update_workbook.py` can build an event field sheet in the same layout as the
hand-built **Scottish Open Field** tab (`Player, SG OTT, Points, Approach,
Putting, Around Green, T2Green, Form, History, Tournament, Tour`):

```bash
python datagolf/update_workbook.py \
  datagolf/workbooks/PGA_stat_caddy_latest.xlsx \
  datagolf/workbooks/PGA_stat_caddy_updated_YYYY-MM-DD.xlsx \
  --course-fit \
  --field-sheet "Wyndham Field" \
  --tournament "Wyndham Championship" \
  --export-field-csv datagolf/workbooks/StatCaddy_Wyndham_Field_YYYY-MM-DD.csv
```

Players with a non-null `T2Green` on **PGA Database** are the current field.
The field sheet uses the same cross-sheet formulas as Scottish Open Field;
LibreOffice headless recalc (when installed) restores cached values after save.

## Field Stats page (`build_field_stats_page.py`)

Builds the "what does this week's field look like?" page for the current event
from the CSV snapshots in `datagolf/data/` — read-only, no API calls. The field
(`dg_field.csv`) is joined to the skill ratings (on `dg_id`), the schedule (for
course, location and the Thursday-to-Sunday date label) and the week's StatCaddy
field sheet (`workbooks/StatCaddy_Field_latest.csv`, for Course Fit / Form /
History / Points, used only when it was built for the same event). Pre-tournament
win probabilities are shown only when `dg_predictions.csv` covers the same event;
a stale snapshot is dropped, not displayed.

```bash
python datagolf/build_field_stats_page.py          # writes field_stats/
python datagolf/build_field_stats_page.py --push   # also update the live page
```

Outputs in `field_stats/` (all self-contained, no external assets):

- `statcaddy-field-stats.html` — standalone page with summary cards and a
  sortable per-player table (SG components, driving, Course Fit, Form, History,
  Points; unrated players show em dashes and sort last)
- `wp-embed.html` — WordPress-safe embed (scoped CSS + base64 JS), same pattern
  as the simulator embed
- `players.json` — the merged per-player table
- `statcaddy-field-stats.csv` — the same table as a downloadable CSV for
  Excel / Google Sheets (odds columns included only when predictions are current)

The push step needs `WP_URL`, `WP_USERNAME`, `WP_APP_PASSWORD` and
`WP_FIELD_STATS_PAGE_ID` (the WordPress page to overwrite).

## Scheduling

`.github/workflows/update-datagolf-csv.yml` runs the script daily and commits
changed CSVs back to the repo. It can also be triggered manually from the
Actions tab. It requires the `DATAGOLF_KEY` repository secret.

## Related: sportsdata MCP server

`.cursor/mcp.json` registers the [sportsdata-mcp](https://github.com/DanielTomaro13/sportsdata-mcp)
server (Data Golf groups only), which exposes these same endpoints as agent
tools for interactive exploration in Cursor. It reads the same `DATAGOLF_KEY`
environment variable.
