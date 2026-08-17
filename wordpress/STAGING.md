# Set up a StatCaddy staging website

Production is the WordPress / WooCommerce site at **statcaddygolf.com** (SiteGround).
Use a staging copy to test plugin updates, Elementor layouts, the matchup simulator,
and the Data Golf load pipeline **without touching live members or Stripe charges**.

The host already uses SiteGround SuperCacher (`sg-cachepress`), so the built-in
SiteGround Staging tool is the right first option.

Official host docs: [Create a staging copy](https://www.siteground.com/tutorials/staging/create-staging/).

## 1. Create the SiteGround staging copy

Staging is included on **GrowBig** and **GoGeek**. It is not available on StartUp.
If the Staging menu is missing, skip to [Fallback if Staging is not on the plan](#fallback-if-staging-is-not-on-the-plan).

1. Log in to [SiteGround](https://my.siteground.com/) and open **Site Tools** for
   `statcaddygolf.com`.
2. Go to **WordPress → Staging**.
3. Select the live WordPress install, set a staging name (for example `staging1`),
   and click **Create**.
4. If SiteGround asks about extra files outside the default WordPress tree, include
   anything the live site actually serves (theme assets, uploaded CSVs, custom JS).
   Skip unrelated folders.
5. Wait until the copy finishes. The URL will look like
   `https://staging1.statcaddygolf.com`.

SiteGround clones files and the database, rewrites the site URL, and disables
WordPress cron on the copy so cloned WooCommerce jobs do not send invoices or
retry subscription charges.

### DNS (only if nameservers are not at SiteGround)

Staging uses subdomains. If `statcaddygolf.com` nameservers are **not** pointed at
SiteGround, add A records at the current DNS host for both:

- `staging1.statcaddygolf.com`
- `www.staging1.statcaddygolf.com`

Point them at the SiteGround site IP shown in Site Tools. Then return to Staging
and open the copy.

## 2. Lock staging down before anyone uses it

Open the staging wp-admin (orange **Staging** badge in the admin bar) and do this
**before** testing checkout, membership, or pipeline deploys.

| Check | Why |
|---|---|
| Confirm the URL is the staging subdomain, not `statcaddygolf.com` | Easy to edit the live site by mistake |
| **Settings → Reading**: discourage search engines | Keep staging out of Google |
| Password-protect the staging site in Site Tools (or HTTP auth) | Members should not land on a clone |
| WooCommerce → Settings → Payments: **Stripe test mode** (or test API keys) | Cloned live keys can charge real cards |
| WooCommerce emails: disable or route to your inbox only | Cloned customers must not get mail |
| Do not reconnect live Stripe webhooks to the staging URL | Live events should keep hitting production |

SiteGround already turns off WP-Cron on staging. Leave it off unless you are
deliberately testing scheduled jobs, and never point those jobs at live Stripe.

## 3. Confirm StatCaddy pieces on staging

The clone should already include Elementor Pro, ACF Pro, WooCommerce
Subscriptions, and the live theme. Still verify:

1. **Plugins → Installed Plugins**: **StatCaddy Golf Data** is active.
   If it is missing, upload `wordpress/statcaddy-golf-data.zip` (see
   [README.md](README.md)).
2. `GET https://staging1.statcaddygolf.com/wp-json/wp/v2/dg_players` returns `200`.
3. **Golfers** appears in wp-admin, and **Players** / Additional Settings still
   open (the weekly simulator deploy uses those screens).
4. `/golflogin` and `/matchup-simulator/` load on the staging host.

Create a **new Application Password** on the staging user
(**Users → Profile → Application Passwords**) even if the cloned one still works.
Use it only for REST (`load_wordpress.py`). Browser deploys still need the real
account password.

## 4. Point this repo at staging

### Local

Copy `.env.example` to `.env` and set the staging host:

```bash
WP_URL=https://staging1.statcaddygolf.com
WP_USERNAME=your-wp-user
WP_PASSWORD=real-login-password-for-golflogin
WP_APP_PASSWORD=staging-application-password
DATAGOLF_KEY=...
```

Dry-run first:

```bash
python datagolf/load_wordpress.py --data-dir datagolf/data --dry-run
DRY_RUN=1 python datagolf/deploy_simulator.py
```

Then drop `DRY_RUN` only when you intend to write to staging.

### GitHub Actions

Add repository secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|---|---|
| `WP_STAGING_URL` | Staging origin, e.g. `https://staging1.statcaddygolf.com` |
| `WP_STAGING_USERNAME` | Optional; falls back to `WP_USERNAME` |
| `WP_STAGING_PASSWORD` | Optional; falls back to `WP_PASSWORD` (real login, not an app password) |
| `WP_STAGING_APP_PASSWORD` | Optional; falls back to `WP_APP_PASSWORD` |

Scheduled weekly jobs stay on **production**. To test against staging, run the
workflow from the Actions tab and set **target** to `staging`:

- **Weekly Simulator Deploy** — Playwright field/sim upload
- **Update Data Golf CSVs** — REST upsert of `dg_player` records
- **Weekly StatCaddy Workbook Update** — public matchup-model page push

If `WP_STAGING_URL` is missing, a staging run fails before it can touch production.

## 5. What to test on staging

- Install or update **StatCaddy Golf Data** and confirm `/wp-json/wp/v2/dg_players`.
- Run `load_wordpress.py` and check a Golfer in wp-admin.
- Run **Weekly Simulator Deploy** with target `staging` and `dry_run=false`.
  Confirm the simulator stays **Disabled** on failure and **Enabled** only after
  verification.
- Exercise `/matchup-simulator/` as a test member (staging Stripe, not live).
- Purge SiteGround cache from the staging admin bar if pages look stale.

## 6. Push staging to live (when you are ready)

In Site Tools → **WordPress → Staging**, use deploy on that copy.

- **Files only** — safest for plugin/theme/code changes. Does not overwrite live
  orders, members, or this week's simulator CSV.
- **Database only / full deploy** — overwrites live content. **Do not** full-deploy
  if production has taken new memberships, orders, or a newer weekly simulator
  deploy since the staging copy was created.

After a files-only push, purge SuperCacher on production
(admin bar → SiteGround cache purge).

If a full deploy goes wrong, SiteGround keeps a restore point from that deploy.
Use it immediately; do not keep publishing on a half-overwritten live site.

## Fallback if Staging is not on the plan

1. Upgrade the SiteGround plan to GrowBig, **or**
2. Duplicate the WordPress install into a subdomain you create yourself
   (Site Tools → **WordPress → Install & Manage** → clone / new install on
   `staging.statcaddygolf.com`), then repeat [section 2](#2-lock-staging-down-before-anyone-uses-it)
   and [section 3](#3-confirm-statcaddy-pieces-on-staging).

A plugin such as WP Staging can also clone into a subdirectory. Prefer a
subdomain so `WP_URL` for the pipeline is a normal origin
(`https://staging.statcaddygolf.com`) with its own SSL.

## Related

- Plugin install: [README.md](README.md)
- Data Golf → WordPress load: [`datagolf/README.md`](../datagolf/README.md)
- Weekly simulator deploy: `.github/workflows/weekly-simulator.yml`
