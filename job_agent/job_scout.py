#!/usr/bin/env python3
"""Job Scout agent.

Searches job boards for software engineering manager roles above a salary
floor and produces a Markdown report with direct apply links.

Providers:
  - Adzuna (needs ADZUNA_APP_ID / ADZUNA_APP_KEY) - indexes Indeed, LinkedIn
    and thousands of company career pages, with structured salary data.
  - JSearch via RapidAPI (needs RAPIDAPI_KEY) - aggregates Google for Jobs,
    which includes LinkedIn and Indeed postings.
  - Remotive (no key) - remote jobs, free-text salary.
  - RemoteOK (no key) - remote jobs, structured salary (often missing).

Note: this agent finds and ranks jobs; it does not auto-submit applications.
LinkedIn and Indeed prohibit automated submissions in their terms of service
and enforce it with bot detection, so the report links straight to each
posting's apply page instead.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "job-scout-agent/1.0"
STATE_DIR = Path(__file__).parent / "state"
REPORTS_DIR = Path(__file__).parent / "reports"

MIN_SALARY = int(os.environ.get("MIN_SALARY", "230000"))
INCLUDE_UNKNOWN_SALARY = os.environ.get("INCLUDE_UNKNOWN_SALARY", "0") == "1"
KEYWORDS = [
    k.strip().lower()
    for k in os.environ.get(
        "JOB_KEYWORDS",
        "software engineering manager, engineering manager,"
        " software development manager, head of engineering,"
        " director of engineering, director of software engineering",
    ).split(",")
    if k.strip()
]
ADZUNA_COUNTRY = os.environ.get("ADZUNA_COUNTRY", "us")
HOURS_PER_YEAR = 2080


@dataclass
class Job:
    title: str
    company: str
    url: str
    source: str
    location: str = ""
    salary_min: int | None = None
    salary_max: int | None = None
    posted: str = ""
    key: str = field(default="", compare=False)

    def __post_init__(self):
        self.key = hashlib.sha1(
            f"{self.title.lower()}|{self.company.lower()}".encode()
        ).hexdigest()[:16]

    @property
    def salary_display(self) -> str:
        if self.salary_min and self.salary_max and self.salary_min != self.salary_max:
            return f"${self.salary_min:,} - ${self.salary_max:,}"
        best = self.salary_max or self.salary_min
        return f"${best:,}" if best else "not listed"


def http_get_json(url: str, headers: dict | None = None):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


_SALARY_NUM = re.compile(r"\$?\s*(\d{1,3}(?:[.,]\d{1,3})*)\s*(k)?", re.IGNORECASE)


def parse_salary_text(text: str) -> tuple[int | None, int | None]:
    """Parse free-text salary like '$170k - $200k' or '$50-$75 /hour'."""
    if not text:
        return None, None
    hourly = bool(re.search(r"/\s*(hour|hr)|per\s+hour|hourly", text, re.IGNORECASE))
    values = []
    for num, k in _SALARY_NUM.findall(text):
        # "35,3k" is European decimal notation; "170,000" is a thousands separator.
        cleaned = num.replace(",", ".") if (k and "," in num and len(num.split(",")[-1]) < 3) else num.replace(",", "")
        try:
            val = float(cleaned)
        except ValueError:
            continue
        if k:
            val *= 1000
        if hourly:
            val *= HOURS_PER_YEAR
        if val >= 1000:  # ignore stray small numbers like "401" in "401(k)"
            values.append(int(val))
    if not values:
        return None, None
    return min(values), max(values)


def title_matches(title: str) -> bool:
    t = title.lower()
    return any(k in t for k in KEYWORDS)


def salary_qualifies(job: Job) -> bool:
    best = job.salary_max or job.salary_min
    if best is None:
        return INCLUDE_UNKNOWN_SALARY
    return best >= MIN_SALARY


# --------------------------------------------------------------------------
# Providers
# --------------------------------------------------------------------------

def fetch_adzuna() -> list[Job]:
    app_id = os.environ.get("ADZUNA_APP_ID")
    app_key = os.environ.get("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        print("adzuna: skipped (set ADZUNA_APP_ID and ADZUNA_APP_KEY)")
        return []
    jobs = []
    for keyword in KEYWORDS:
        params = urllib.parse.urlencode({
            "app_id": app_id,
            "app_key": app_key,
            "what": keyword,
            "salary_min": MIN_SALARY,
            "results_per_page": 50,
            "content-type": "application/json",
        })
        url = f"https://api.adzuna.com/v1/api/jobs/{ADZUNA_COUNTRY}/search/1?{params}"
        try:
            data = http_get_json(url)
        except Exception as e:
            print(f"adzuna: error for '{keyword}': {e}")
            continue
        for r in data.get("results", []):
            jobs.append(Job(
                title=r.get("title", "").replace("<strong>", "").replace("</strong>", ""),
                company=(r.get("company") or {}).get("display_name", "unknown"),
                url=r.get("redirect_url", ""),
                source="Adzuna",
                location=(r.get("location") or {}).get("display_name", ""),
                salary_min=int(r["salary_min"]) if r.get("salary_min") else None,
                salary_max=int(r["salary_max"]) if r.get("salary_max") else None,
                posted=(r.get("created") or "")[:10],
            ))
    print(f"adzuna: {len(jobs)} raw results")
    return jobs


def fetch_jsearch() -> list[Job]:
    api_key = os.environ.get("RAPIDAPI_KEY")
    if not api_key:
        print("jsearch: skipped (set RAPIDAPI_KEY)")
        return []
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }
    jobs = []
    for keyword in KEYWORDS[:3]:  # stay inside free-tier quotas
        params = urllib.parse.urlencode({
            "query": f"{keyword} salary ${MIN_SALARY // 1000}k",
            "num_pages": 1,
            "date_posted": "week",
        })
        try:
            data = http_get_json(f"https://jsearch.p.rapidapi.com/search?{params}", headers)
        except Exception as e:
            print(f"jsearch: error for '{keyword}': {e}")
            continue
        for r in data.get("data", []):
            jobs.append(Job(
                title=r.get("job_title", ""),
                company=r.get("employer_name", "unknown"),
                url=r.get("job_apply_link", ""),
                source=f"JSearch ({r.get('job_publisher', 'unknown')})",
                location=", ".join(filter(None, [r.get("job_city"), r.get("job_state")])),
                salary_min=int(r["job_min_salary"]) if r.get("job_min_salary") else None,
                salary_max=int(r["job_max_salary"]) if r.get("job_max_salary") else None,
                posted=(r.get("job_posted_at_datetime_utc") or "")[:10],
            ))
    print(f"jsearch: {len(jobs)} raw results")
    return jobs


def fetch_remotive() -> list[Job]:
    jobs = []
    try:
        data = http_get_json(
            "https://remotive.com/api/remote-jobs?search="
            + urllib.parse.quote("engineering manager")
        )
    except Exception as e:
        print(f"remotive: error: {e}")
        return []
    for r in data.get("jobs", []):
        lo, hi = parse_salary_text(r.get("salary", ""))
        jobs.append(Job(
            title=r.get("title", ""),
            company=r.get("company_name", "unknown"),
            url=r.get("url", ""),
            source="Remotive",
            location=r.get("candidate_required_location", ""),
            salary_min=lo,
            salary_max=hi,
            posted=(r.get("publication_date") or "")[:10],
        ))
    print(f"remotive: {len(jobs)} raw results")
    return jobs


def fetch_remoteok() -> list[Job]:
    jobs = []
    try:
        data = http_get_json("https://remoteok.com/api")
    except Exception as e:
        print(f"remoteok: error: {e}")
        return []
    for r in data:
        if not isinstance(r, dict) or not r.get("position"):
            continue
        jobs.append(Job(
            title=r.get("position", ""),
            company=r.get("company", "unknown"),
            url=r.get("url", ""),
            source="RemoteOK",
            location=r.get("location", ""),
            salary_min=int(r["salary_min"]) if r.get("salary_min") else None,
            salary_max=int(r["salary_max"]) if r.get("salary_max") else None,
            posted=(r.get("date") or "")[:10],
        ))
    print(f"remoteok: {len(jobs)} raw results")
    return jobs


# --------------------------------------------------------------------------
# Pipeline
# --------------------------------------------------------------------------

def load_seen() -> set[str]:
    path = STATE_DIR / "seen_jobs.json"
    if path.exists():
        return set(json.loads(path.read_text()))
    return set()


def save_seen(seen: set[str]) -> None:
    STATE_DIR.mkdir(exist_ok=True)
    (STATE_DIR / "seen_jobs.json").write_text(json.dumps(sorted(seen), indent=1))


def run() -> int:
    all_jobs = fetch_adzuna() + fetch_jsearch() + fetch_remotive() + fetch_remoteok()

    matches: dict[str, Job] = {}
    for job in all_jobs:
        if title_matches(job.title) and salary_qualifies(job):
            matches.setdefault(job.key, job)

    seen = load_seen()
    new_jobs = [j for j in matches.values() if j.key not in seen]
    seen.update(matches.keys())
    save_seen(seen)

    ranked = sorted(
        matches.values(),
        key=lambda j: (j.salary_max or j.salary_min or 0),
        reverse=True,
    )

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    REPORTS_DIR.mkdir(exist_ok=True)

    lines = [
        f"# Job Scout Report - {today}",
        "",
        f"Criteria: title matching {', '.join(repr(k) for k in KEYWORDS)};"
        f" salary at least ${MIN_SALARY:,}.",
        "",
        f"**{len(ranked)} matching roles** ({len(new_jobs)} new since last run).",
        "",
    ]
    if ranked:
        lines += [
            "| | Title | Company | Salary | Location | Source | Posted |",
            "|---|---|---|---|---|---|---|",
        ]
        new_keys = {j.key for j in new_jobs}
        for j in ranked:
            flag = "NEW" if j.key in new_keys else ""
            lines.append(
                f"| {flag} | [{j.title}]({j.url}) | {j.company} |"
                f" {j.salary_display} | {j.location or 'n/a'} | {j.source} | {j.posted} |"
            )
    else:
        lines.append(
            "_No matches this run. Add ADZUNA_APP_ID/ADZUNA_APP_KEY or RAPIDAPI_KEY"
            " secrets for far deeper coverage (including LinkedIn and Indeed"
            " postings), or lower MIN_SALARY._"
        )
    report = "\n".join(lines) + "\n"

    (REPORTS_DIR / f"jobs-{today}.md").write_text(report)
    (REPORTS_DIR / f"jobs-{today}.json").write_text(
        json.dumps([asdict(j) for j in ranked], indent=1)
    )
    (REPORTS_DIR / "latest.md").write_text(report)

    print(report)
    print(f"report written to {REPORTS_DIR / f'jobs-{today}.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(run())
