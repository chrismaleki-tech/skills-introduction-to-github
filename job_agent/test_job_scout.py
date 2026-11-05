"""Unit tests for job_scout parsing and filtering logic."""

import job_scout
from job_scout import Job, parse_salary_text, salary_qualifies, title_matches


def test_parse_salary_range_k():
    assert parse_salary_text("$170k - $200k") == (170000, 200000)


def test_parse_salary_single_value():
    assert parse_salary_text("$250k") == (250000, 250000)


def test_parse_salary_full_numbers_with_thousands_separator():
    assert parse_salary_text("$230,000 - $280,000") == (230000, 280000)


def test_parse_salary_european_decimal_k():
    assert parse_salary_text("$35,3k- $52k") == (35300, 52000)


def test_parse_salary_hourly_is_annualized():
    lo, hi = parse_salary_text("$50-$75 /hour")
    assert lo == 50 * 2080
    assert hi == 75 * 2080


def test_parse_salary_empty_and_text_only():
    assert parse_salary_text("") == (None, None)
    assert parse_salary_text("Competitive") == (None, None)


def test_parse_salary_ignores_401k_noise():
    assert parse_salary_text("401(k) match, OTE $240k") == (240000, 240000)


def test_title_matches_default_keywords():
    assert title_matches("Senior Software Engineering Manager")
    assert title_matches("Engineering Manager, AI Platform")
    assert title_matches("Director of Engineering")
    assert not title_matches("Senior Software Engineer")
    assert not title_matches("Account Manager")


def test_salary_qualifies_threshold():
    make = lambda lo, hi: Job("t", "c", "u", "s", salary_min=lo, salary_max=hi)
    assert salary_qualifies(make(200000, 250000))  # max clears the bar
    assert salary_qualifies(make(230000, None))
    assert not salary_qualifies(make(150000, 200000))


def test_salary_unknown_excluded_by_default(monkeypatch):
    monkeypatch.setattr(job_scout, "INCLUDE_UNKNOWN_SALARY", False)
    assert not salary_qualifies(Job("t", "c", "u", "s"))
    monkeypatch.setattr(job_scout, "INCLUDE_UNKNOWN_SALARY", True)
    assert salary_qualifies(Job("t", "c", "u", "s"))


def test_job_dedupe_key_is_stable_and_case_insensitive():
    a = Job("Engineering Manager", "Acme", "url1", "Adzuna")
    b = Job("engineering manager", "ACME", "url2", "Remotive")
    assert a.key == b.key
