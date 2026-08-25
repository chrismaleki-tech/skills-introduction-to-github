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

## Whole seasons of stats: `pull_history.py`

`pull_all.py` snapshots what the API is serving right now. `pull_history.py`
goes the other way: it walks Data Golf's historical event list, pulls
`/historical-raw-data/rounds` for every event in the requested calendar years,
and writes **one row per player per round** into a single CSV.

```bash
python datagolf/pull_history.py                        # 2024-2026, every tour
python datagolf/pull_history.py --years 2025
python datagolf/pull_history.py --years 2024,2025 --tours pga,euro
python datagolf/pull_history.py --skip-download        # rebuild the CSV from the cache
```

The default run covers 1,327 events across all 26 tours Data Golf tracks and
lands in `datagolf/data/history/dg_stats_2024_2026.csv`.

| Column group | Columns |
|---|---|
| Event | `tour`, `calendar_year`, `season`, `event_id`, `event_name`, `event_date`, `event_completed`, `sg_categories`, `traditional_stats` |
| Player | `dg_id`, `player_name`, `fin_text` |
| Round | `round_num`, `course_name`, `course_num`, `course_par`, `start_hole`, `teetime` |
| Scoring | `score`, `birdies`, `bogies`, `pars`, `eagles_or_better`, `doubles_or_worse` |
| Traditional | `driving_dist`, `driving_acc`, `gir`, `scrambling`, `prox_fw`, `prox_rgh`, `great_shots`, `poor_shots` |
| Strokes gained | `sg_ott`, `sg_app`, `sg_arg`, `sg_putt`, `sg_t2g`, `sg_total` |

`dg_id` joins to every other CSV in `datagolf/data/`. Rows are ordered by event
date, so the file reads chronologically from January 2024 onwards.

Data Golf only models the strokes-gained and traditional categories on the tours
it has shot-level data for — 157 of the 1,327 events. Events without them still
contribute their scores, and the columns they do not carry are left **blank**
rather than zero, so a missing stat is never mistaken for an average one. The
`sg_categories` and `traditional_stats` columns say which case a row is in, so
filtering to the fully-covered events is `sg_categories == "yes"`.

A full run is about 1,300 requests throttled to Data Golf's 45/minute limit, so
it takes roughly an hour and a half. Each response is cached under
`datagolf/data/history/_cache/` (gitignored), so an interrupted run resumes
instead of starting over, and `--skip-download` rebuilds the CSV offline in
seconds. Pass `--refresh` to re-fetch events already cached, which is what an
in-progress season needs.

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

## Scheduling

`.github/workflows/update-datagolf-csv.yml` runs the script daily and commits
changed CSVs back to the repo. It can also be triggered manually from the
Actions tab. It requires the `DATAGOLF_KEY` repository secret.

## Related: sportsdata MCP server

`.cursor/mcp.json` registers the [sportsdata-mcp](https://github.com/DanielTomaro13/sportsdata-mcp)
server (Data Golf groups only), which exposes these same endpoints as agent
tools for interactive exploration in Cursor. It reads the same `DATAGOLF_KEY`
environment variable.
