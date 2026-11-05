# Job Scout Agent

Automated agent that searches job boards daily for **software engineering
manager roles paying at least $230K** and delivers a ranked report with
direct apply links.

## How it works

Every day at 14:00 UTC (7am PT), the [`job-scout.yml`](../.github/workflows/job-scout.yml)
workflow:

1. Queries four job sources and filters by title keywords and salary floor.
2. Deduplicates against everything seen in previous runs (`state/seen_jobs.json`).
3. Commits a Markdown + JSON report to `reports/` (newest also at `reports/latest.md`).
4. Opens a GitHub issue titled "Job Scout: N new role(s) at $230K+" whenever
   there are new matches, so you get a notification with one-click apply links.

Run it on demand from the Actions tab ("Job Scout" > "Run workflow"), or
locally with `python3 job_agent/job_scout.py`.

## Job sources

| Source | Key required | Coverage |
|---|---|---|
| Adzuna | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Indexes Indeed, LinkedIn and thousands of career pages, with structured salary filters. Free at [developer.adzuna.com](https://developer.adzuna.com/). |
| JSearch (RapidAPI) | `RAPIDAPI_KEY` | Aggregates Google for Jobs, which includes LinkedIn and Indeed postings. Free tier at [rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch). |
| Remotive | none | Remote jobs; works out of the box. |
| RemoteOK | none | Remote jobs; works out of the box. |

Add the keys as **repository secrets** (Settings > Secrets and variables >
Actions) and the workflow picks them up automatically. Without keys, only the
two remote-job boards are searched, and few postings there list $230K+
salaries, so adding at least the free Adzuna key is strongly recommended.

## Configuration

Set these as environment variables (or edit the workflow):

| Variable | Default | Meaning |
|---|---|---|
| `MIN_SALARY` | `230000` | A job qualifies when its top-of-range salary meets this floor. |
| `JOB_KEYWORDS` | software engineering manager, engineering manager, software development manager, head of engineering, director of engineering, director of software engineering | Comma-separated title keywords. |
| `INCLUDE_UNKNOWN_SALARY` | `0` | Set to `1` to include postings that do not list a salary. |
| `ADZUNA_COUNTRY` | `us` | Adzuna country code. |

## Why it does not auto-submit applications

LinkedIn and Indeed prohibit automated application submission in their terms
of service and enforce it with bot detection, CAPTCHAs, and account bans.
Instead, the report links straight to each posting's apply page so every
application is a single click with your saved resume — without risking your
accounts.

## Tests

```bash
python3 -m pytest job_agent/test_job_scout.py -v
```
