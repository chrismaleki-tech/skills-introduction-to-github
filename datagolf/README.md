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

## Scheduling

`.github/workflows/update-datagolf-csv.yml` runs the script daily and commits
changed CSVs back to the repo. It can also be triggered manually from the
Actions tab. It requires the `DATAGOLF_KEY` repository secret.

## Related: sportsdata MCP server

`.cursor/mcp.json` registers the [sportsdata-mcp](https://github.com/DanielTomaro13/sportsdata-mcp)
server (Data Golf groups only), which exposes these same endpoints as agent
tools for interactive exploration in Cursor. It reads the same `DATAGOLF_KEY`
environment variable.
