# Agent instructions for this repository

This repo drives the StatCaddy golf simulators on the live WordPress site
(statcaddygolf.com) plus AWS data-pipeline experiments. The rules below exist
because past agent sessions broke the live site; follow them for every change.

## Scope discipline

- Make the specific change requested and nothing else. Do not restyle, rename,
  refactor, or "harden" neighboring code, CSS, or live-site content that the
  request did not mention.
- Prefer the smallest diff that fixes the problem. If a broader change seems
  necessary, say so in the summary and keep it in a separate commit so it can
  be reverted independently.

## Live WordPress changes (Code Snippets, pages, theme CSS)

- The live site is production with paying members. Treat every write to it
  like a deploy.
- Never hand-edit live Code Snippets and walk away. All active snippets are
  tracked in `wordpress/snippets/` (manifest: `wordpress/snippets/manifest.json`).
  To change one: edit the repo file, run
  `python datagolf/sync_wp_snippets.py push`, purge the cache, and commit.
  After any intentional live-side edit, run
  `python datagolf/sync_wp_snippets.py pull` and commit the diff.
  `python datagolf/sync_wp_snippets.py check` must pass before you finish —
  CI runs it daily and fails on any drift or untracked active snippet.
- After any live change that affects page output, purge the SiteGround cache
  (admin-bar item `#wp-admin-bar-SG_CachePress_Supercacher_Purge`, or run
  `python datagolf/fix_player_card_headshots_live.py --purge`), then verify as
  a logged-out visitor — logged-in admins bypass the page cache and will show
  you a state members do not see.

## Simulator card CSS — do not break the sliders

The 1v1 (`/matchup-simulator/`, page 166) and multi-player
(`/multi-matchup-simulator/`, page 3736) cards render portraits through slick
sliders: one `.player-container` slide per field player in a wide
`.slick-track` row, clipped to one visible frame by `.slick-list`. Slick sets
the track and slide widths inline.

- NEVER add `width`/`max-width` rules (CSS or jQuery `.css()`) whose subject is
  `.slick-track`, `.slick-slide`, or `.player-container`. Clamping them wraps
  the slide row into a vertical stack and every card except the first player
  renders an empty frame (Aug 2026 incident).
- To contain the slider on small screens, clip at `.slick-list` and size
  `.player-image` / its `<img>` instead.

## Mandatory verification for simulator changes

After ANY change touching simulator CSS, JS, snippets, or deploys, run:

```
python datagolf/verify_simulator_cards.py --select --shots-dir /tmp/shots
```

It logs in, loads both simulator pages at desktop/laptop/phone widths, and
fails unless every card's selected portrait is visible in its frame. Include
its output (and screenshots for visual changes) as evidence. CI also runs this
daily and after the weekly deploy (`.github/workflows/verify-simulator.yml`).

## Environment / testing notes

- Python deps for the live-site scripts: create a venv and
  `pip install playwright openpyxl requests scipy`, then
  `python -m playwright install chromium` (add `--with-deps` on fresh VMs).
- Credentials arrive as env vars: `WP_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`
  (REST), `WP_PASSWORD` (browser `/golflogin` — REST Application Passwords
  cannot log into wp-admin), `DATAGOLF_KEY`.
- The same names exist as GitHub Actions secrets for workflows.
