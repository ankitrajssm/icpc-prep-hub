# ICPC Prep Hub

A free, open-source companion for ICPC prep — regionals through World Finals.
No build step, and deploys to GitHub Pages for free. Clone it, point
`js/config.js` at your own Supabase project (see [Account
setup](#account-setup-required) below), and it just works.

The site is a handful of plain static pages behind a shared nav — Home,
Dashboard, Codeforces, Team, Roadmap, and Self-rule — not a single long
scroll. See [Pages](#pages) below.

Sign in with just an email (a passwordless magic link — no password to set or
leak) and verify your one Codeforces handle, once, on the Dashboard. From
then on everything you do — roadmap progress, points, solved log, rewards —
is stored server-side (Supabase), tied to that account, and follows you to
every device you sign into. See [Account setup](#account-setup) below for
the one-time project configuration this needs. The app also (optionally)
reads a public, pre-computed baseline dataset for the Codeforces Analysis
page's cohort comparisons — see [Codeforces baseline data](#codeforces-baseline-data).

## Features

- **Multi-subject roadmap** — 99 topics across 8 subjects (Math & Number
  Theory, Data Structures, Graphs, Dynamic Programming, Strings, Greedy &
  Sorting, Geometry, and Contest Meta-Skills), each split into
  Foundations → Core → Advanced and curated against established
  difficulty-ordered CP curricula (USACO Guide's own Bronze→Platinum
  progression, cp-algorithms) so the jump between phases stays gradual
  instead of leaping straight to World-Finals-tier material. Every topic has
  a one-line "why it matters" note and a link to a real reference
  ([cp-algorithms.com](https://cp-algorithms.com), [usaco.guide](https://usaco.guide),
  [cses.fi](https://cses.fi), Codeforces EDU, the ICPC World Finals archive).
  The page itself is a two-pane picker — subjects with a progress bar down
  the left, the selected subject's full checklist on the right — instead of
  one long accordion. Checkbox state syncs to your account. Locked behind
  Codeforces verification (see Gamification below), same as Self-rule's
  points/rewards — a locked notice shows instead until you verify, so
  progress can't be checked off under an unproven handle. The Dashboard's
  compact roadmap-progress summary stays visible either way; it's read-only.
- **Smart timeline** — set an optional target contest date and get a
  countdown plus a pacing plan that proportionally allocates remaining time
  across the roadmap's phases, with an ahead/behind indicator based on your
  actual checklist progress. No target date set? You get a sensible
  relative estimate instead of a hardcoded week-by-week table.
- **Gamification** — points for problems you solve (`round(rating / 100) - 5`
  for rated problems — 3 points at Codeforces' lowest rating, 800, 4 at 900,
  and so on — flat 5 for unrated, ×1.5 for one focus tag you pick from
  Codeforces' own tag list), but only once your Codeforces handle has passed
  verification (see [Known limitations](#growing-the-backend-later) below) — sync
  itself is locked until then, so an unverified (or someone else's) handle can't
  populate your stats at all, let alone earn points by claiming someone else's
  solve history. Problems solved *before*
  your gamification start date are also logged for stats but score 0
  points, so importing your whole CF history doesn't hand you a windfall;
  that start date is set automatically — and only — the moment your handle
  passes verification, and it's **not user-editable**, so there's no form
  field to backdate it and retroactively cash in on old solves. (A target
  contest date, unrelated to any of this, defaults to a sensible placeholder
  and is freely editable on the Dashboard.) Until verification, the whole
  Self-rule page (points overview, activity, and rewards) shows a single
  locked notice instead of a permanently-stuck-at-0 experience.
  - **Streaks** — a day counts if it has at least one points-earning solve
    (so it naturally starts counting from your gamification start date with
    no separate cutoff). Shown on both the Dashboard and Self-rule; if
    today's still open it prompts *"Solve 1 Codeforces problem today to
    maintain the streak."*
  - **Streak bonus** — the first points-earning solve of each day adds a
    bonus equal to your incoming streak length, capped at +10, so staying
    consistent is worth more than cramming.
  - **Rewards** — a user-editable catalog you spend points on; the 3 starter
    rewards ship locked (can't be deleted, only redeemed) so there's always
    something to spend on, while anything you add yourself is fully
    removable.
  - **Points overview & activity** — current balance, lifetime earned,
    rewards redeemed, and progress toward the cheapest reward you can't
    afford yet, plus a daily/weekly/monthly earned-vs-spent breakdown and a
    cumulative "spent by reward" tally.
- **Codeforces sync** — log in once (see Codeforces handle verification
  below) and sync your solved problems directly from the CF API. If the live
  fetch fails (CORS, network,
  rate limiting), there's always a manual fallback: a link to open the same
  API URL yourself, and a textarea to paste the JSON back in. A quick manual
  "log one solve" form covers one-off additions. The same sync also derives
  (at zero extra API cost) how many wrong attempts preceded each of your ACs
  and which problems you've attempted but never solved, plus a rating
  trajectory from one extra cheap call.
- **Codeforces Analysis** — split into two clearly-labeled groups below the
  summary stats, since it used to be one flat run of sections with no
  distinction between "facts about you" and "you vs. a baseline":
  - **Profile analysis** — your own solve history: Accuracy per tag, Rating
    trajectory, Problem ratings, Solve activity, Unsolved/attempted (see
    below). Locked behind Codeforces verification, same as sync itself (see
    Gamification above) — until then this tab is hidden and Comparison is
    the only one shown.
  - **Comparison** — how your tag mix stacks up against a baseline, and
    what to practice next based on the gap (see below).

  Comparison normalizes your solved-tag ratios against what's *naturally*
  common on Codeforces, so raw counts aren't misread ("you solved 100 math
  and 30 trees" isn't "trees is weak" if math is just far more common at
  your rating level). Compares you against three cohort tiers (Top 500 /
  Top 10,000 / Average user, using real, current rating cutoffs) plus
  Tourist by name, each toggleable between the last year and all-time. See
  [Codeforces baseline data](#codeforces-baseline-data) for how the
  baseline numbers are generated. **None of the 4 cohort tiers require
  signing in** — `cf_baseline_data`/`cf_percentiles` are public-read tables
  (`using (true)` in the RLS policy), so the Supabase anon client can read
  them whether or not anyone's authenticated; the only real requirement is
  that this deployment has Supabase configured at all. A fifth tier,
  **Compare with someone**, lets you paste any public Codeforces handle and
  get the same tag-mix comparison against that one specific player instead
  of a sampled cohort — their data is fetched fresh on demand and never
  stored (it's just a live public Codeforces API call, no account needed on
  either side). Also on this page:
  - **Accuracy per tag** — average wrong attempts before AC, by tag.
  - **Rating trajectory** — a chart of your rating across contests, plus
    your live percentile among active rated Codeforces users.
  - **Problem ratings** — a histogram of solved-problem count by difficulty
    band, bars colored like Codeforces' own rating tiers (gray → green →
    cyan → blue → violet → orange → red), optionally filtered to a single
    tag via a dropdown so you can see, say, just your `dp` solves' rating
    spread instead of everything at once. The bucket range trims itself to
    whatever's actually in the (filtered) data, so it never shows a long
    empty tail for ratings you haven't reached yet. The avg. rating figure
    shown alongside (and the matching one in the top summary stats) is
    rating-weighted, not a plain mean — see the Team Analyzer's "Tag
    breakdown" entry below for why a plain average is misleading here; both
    pages use the identical weighting formula so the numbers never quietly
    disagree with each other.
  - **Solve activity** — a GitHub-style heatmap of your solving consistency
    over the last year.
  - **Unsolved/attempted** — problems you've tried but not solved, as
    ready-made practice targets.
  - **Next problem recommendations** — unsolved problems in your weak tags,
    just above a target rating blended from your current CF rating *and*
    the typical rating of what you've actually been solving lately (these
    can diverge — a rusty high-rated account, or someone actively
    upskilling past their old rating).
- **ICPC Team Analyzer** — paste your handle plus two teammates' (a real
  ICPC team is exactly 3 people) and get a comparative analysis, live and
  never stored (same trust model as Compare with someone, so it needs no
  account):
  - **Role split — Reader / Coder / Thinker.** This is the standard 3-person
    ICPC role division described in real team-strategy writeups (see
    Sources below), not an invented label set: the Reader reads fastest and
    classifies problems by topic, the Coder is the fastest/cleanest
    implementer of standard-technique problems, the Thinker cracks the
    hardest, most insight-heavy ones. Each role is scored from the signal
    that actually matches its real job:
    - **Reader** — topic *breadth*, computed over only each person's most
      recent ~150 solves, not their lifetime history (Pielou's evenness
      index blended with distinct-tag count). Lifetime counts were tried
      first and produced a real bug: a player with thousands of career
      solves mechanically touches nearly every tag in existence just from
      volume, which made the highest-volume player look like the best
      "generalist" regardless of whether that was still true of their
      *current* solving pattern — a sample-size artifact, not a real signal.
    - **Coder** — per-topic *rating* (not solve-count ratio — see below) in
      standard-technique tags, blended with accuracy and live-contest solve
      speed.
    - **Thinker** — per-topic rating in insight-heavy tags, blended with
      current rating and "reach" (the average rating of a person's
      *hardest* solves minus their own rating — a ceiling/ambition signal
      grounded in how Codeforces itself defines problem difficulty relative
      to a solver's rating, using peak reach rather than a lifetime average
      so a decade of easy warm-up solves doesn't swamp the signal for
      experienced players).

    The 3-way assignment is picked by exhaustively scoring all 6 possible
    permutations, not a first-come-first-served greedy pick, which is
    provably non-optimal even at this size (the classic assignment problem,
    generally solved by the Hungarian algorithm — trivial to brute-force at
    exactly 3 members).
  - **Strength is a per-topic RATING, not a solve-count ratio.** A tag's
    "share of your solves" only measures how much you *practiced* it, not
    how good you are at it — solving 100 easy problems in a tag produces a
    higher ratio than solving 20 hard ones, despite the second person
    clearly being stronger there. Coder/Thinker scoring and the whole Domain
    split below instead use each person's average Codeforces *rating*
    within a tag (the same number space as their own rating, so "~2800" in
    a domain reads exactly like a rating) — a genuine strength measure, not
    a practice-volume measure. The tag-mix comparison chart still shows
    plain solve-share percentages (now with the raw count alongside each
    one) since that's a legitimately different, still-useful question:
    *where does this person's practice concentrate*, as opposed to *how
    strong are they*.
  - **Domain split — Math & Number Theory / Graphs & Data Structures /
    Geometry & Strings.** A second, independent axis from Role — real teams
    also assign topic ownership ("whoever's problem this clearly is, they
    take it") separately from workflow role, and the two don't have to line
    up. Same optimal-assignment approach, scored from each person's
    per-topic rating (see above) in that domain's tags.
  - **Team gaps, split into two real failure modes.** *Knowledge gaps* —
    topics nobody on the team solves much of at all, now shown with the
    actual best-coverage percentage per tag. *Execution gaps* — topics the
    team attempts plenty but still gets wrong a lot (aggregated accuracy
    across all 3 members' raw counts, not an average of percentages, which
    would misweight small samples), shown with the real attempt count — a
    different, more specific problem ("we know the theory, we keep messing
    up the write-and-debug") than a knowledge gap, matching the classic
    post-contest-review distinction described in ICPC coaching writeups.
  - **Team stats + a compact "Tag breakdown" chart.** A headline row
    (average team rating, rating spread, one combined accuracy figure, how
    many of the app's core ICPC tags the team has touched at all) up front,
    then one row per core ICPC tag with all 3 members side by side — a
    range bar (their lowest-to-highest solved rating, marker at the
    weighted average) plus their rating, solve count, and solve-share
    together in one line, sorted by the team's best rating per tag, no
    added commentary. The average is rating-weighted (each solve's
    contribution scaled by the square of its own rating), not a plain
    mean — a plain mean has a real failure mode: 100 solves ground out at
    800 early on would keep averaging a tag down to ~1200-1300 even after
    someone's moved on to solving 1700-1800s in it, since the old volume
    outnumbers the new. Weighting toward harder solves pulls the number
    meaningfully toward current skill instead (same formula, and same fix,
    applied to the Codeforces page's "avg. rating" figures below). This
    used to be
    two separate sections (a "Tag ratings" list and a "Tag mix comparison"
    list, each iterating the same ~25 tags on its own multi-line-per-person
    rows) — merged into one compact table-style layout since showing the
    same tag list twice, at 3-4 lines per person each time, made the page
    far longer than the information actually needed. A range bar beats a
    single averaged number here too: solving a tag from 1000 to 2600 reads
    very differently from a tight 1700-1900 cluster even at the same
    average, and flattening that to one number hides it. Each bar is built
    from 100-wide rating segments (same bucketing as the Codeforces page's
    histogram below) shaded by how many solves fall in each — **hover any
    point on a bar** for an exact count at that rating, in that tag. This
    is a real cursor-tracking tooltip, not a native `title` per segment —
    segments can be just a few pixels wide (unhittable on their own) and
    live inside a clipped container (which would clip a title too), so
    hover is computed continuously from cursor position across the whole
    bar instead.
  - **Non-topic signals**, directly answering "where do you lack besides
    topics" — each person's overall accuracy/bug-rate, a callout when
    accuracy is notably worse specifically on implementation-heavy problems,
    and live-contest solve speed ranked relative to the other two (not an
    absolute "fast/slow" score, since there's no fair universal cutoff).
  - **Fetches are sequenced, not fired all at once, and retry transient
    failures.** Firing all 3 handles' requests simultaneously (6 total: 2
    Codeforces endpoints x 3 handles) reliably triggered CF's rate limiting
    — either failing the whole analysis, or worse, silently dropping just
    one handle's rating-history call while their submissions call
    succeeded, which used to be mistaken for "this person is unrated"
    instead of "this request failed." Handles are now fetched one at a
    time with a short stagger, and a rate-limit/server-hiccup failure gets
    retried a couple of times before being surfaced as a real error.
  - An earlier prototype of this app had a hardcoded, non-generalizing
    3-person team-roles card; this is the real version, built from actual
    solve history and real ICPC coaching methodology instead. The per-person
    summary paragraphs are a deterministic template built from the real
    computed numbers, not a live AI call — an LLM API key can't be safely
    embedded in this site's client-side JS the way the Supabase anon key can
    (Row Level Security protects that one; no LLM provider has an equivalent
    guard over token spend), and a template can't hallucinate a plausible-
    sounding but wrong insight.
  - **Sources**: [Neel Mishra, "ICPC Team Strategy"](https://neelmishra.github.io/blog/cp/contest-strategy/icpc-strategy.html)
    (the Reader/Coder/Thinker split and the Math-NT / Graphs-DS /
    Geometry-Strings domain split); [KTH contest-wiki, "Team strategy"](https://lukipuki.github.io/contest-wiki/team-strategy.html)
    (insight vs. implementation as genuinely separate skills, not one
    scale); [Codeforces, "Rating the Difficulty of Codeforces Problems"](https://codeforces.com/blog/entry/46304)
    (problem rating is calibrated directly against solver rating, the basis
    for the "reach" metric). Pielou's evenness index is a standard
    diversity-index technique from information theory/ecology, applied here
    to a solver's tag distribution rather than invented for this project.
- **Reports** — stats split cleanly into "since your gamification start
  date" (active, scoring) vs. "before it" (historical, imported, non-scoring)
  — never blended. Today/last-7-days summaries, plus a rating-bucket and
  top-tags breakdown for whichever period you're looking at.
- **Backup & restore** — export your account's data as JSON (your own copy,
  for archiving or peace of mind), and import a JSON file back to overwrite
  it. Not needed to move between devices — signing in with the same email
  anywhere already gives you the same data — this is for local backups and
  disaster recovery.
- **Sign in (magic-link email) + Codeforces handle verification** — two
  separate steps. Sign in with just an email — Supabase emails you a one-
  time link (and, in the same email, a 6-digit code you can paste in
  instead, for when clicking through isn't convenient) — no password, ever.
  Then, once, verify you own a Codeforces handle (submit a compile-error
  solution to a specific problem within a time window — the standard trick,
  since Codeforces has no OAuth); that handle is linked to your account for
  good — a database-level uniqueness constraint means the same handle can
  never be claimed by a second account. First-time verification sets your
  gamification start date to that moment; sign in again later, from any
  device, and everything — progress, points, solved log, rewards — is
  exactly as you left it, because it's stored server-side against your
  account, not this one browser.
- **Polish** — responsive down to ~400px, respects `prefers-color-scheme`
  with a manual light/dark/auto toggle, and a wide multi-column dashboard
  layout (side-by-side cards, a subject grid, a two-pane picker) rather than
  one long single-column scroll of stacked cards.

## Pages

| Page | What's there |
|---|---|
| `index.html` (Home) | A small progress teaser and links into the rest of the app |
| `dashboard.html` | Codeforces handle verification, preferences, Timeline, your Streak, a compact roadmap-progress summary, your 5 most recent solves, Backup & Restore |
| `codeforces.html` | Sync, your full solved log, Reports, and the Codeforces Analysis card |
| `team.html` | ICPC Team Analyzer — paste 3 handles, get a role split, tag gaps, and accuracy/speed callouts |
| `roadmap.html` | The full 99-topic, 8-subject checklist, as a subject picker + detail pane (locked until your Codeforces handle is verified) |
| `self-rule.html` | Points overview & streak, a daily/weekly/monthly activity breakdown, the points-formula explainer, the reward catalog, and redemption history |

A shared header/nav (`js/nav.js`) and a shared bootstrap (`js/shell.js`, which
owns theme init and the points badge) run on every page, so theme and your
points balance are consistent no matter which page you land on first.

## Running locally

No build step, no dependencies. Any static file server works:

```bash
git clone https://github.com/<ankitrajssm>/icpc-prep-hub.git
cd icpc-prep-hub
python -m http.server 8080
```

Then open `http://localhost:8080`. (Opening `index.html` directly via
`file://` also mostly works, but a local server avoids occasional
browser restrictions and is recommended.)

## Deploying to GitHub Pages

This repo ships a GitHub Actions workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that
deploys the site to GitHub Pages on every push to `main`. To enable it on
your own fork/copy:

1. Push the repo to GitHub.
2. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or re-run the workflow from the **Actions** tab).

Your site will be live at `https://ankitrajssm.github.io/icpc-prep-hub/`.

Prefer plain branch-based Pages instead? Delete the workflow file, set
**Settings → Pages → Source** to **Deploy from a branch**, and pick `main` /
`(root)`. There's no build step either way — it's static files.

## Account setup (required)

Sign-in and every account's data (roadmap progress, points, solved log,
rewards) need a real Supabase project — there's no local-only fallback mode.

1. Create a free project at [supabase.com](https://supabase.com).
2. Apply every migration in [`supabase/migrations/`](supabase/migrations), in
   filename (timestamp) order — this creates `profiles` (one row per signed-in
   user, RLS-scoped so you can only ever read/write your own row) and a
   uniqueness constraint that stops the same Codeforces handle from being
   verified on two accounts. (The same migrations folder also has the
   separate, optional Codeforces-baseline tables — see below.) Two ways to
   apply it — pick one:
   - **Supabase CLI (recommended):**
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>   # found in your project's URL/Settings
     npx supabase db push
     ```
   - **Manual:** open the SQL editor (left sidebar) and paste/run each
     migration file's contents, oldest first.
3. In **Project Settings → API**, copy the **Project URL** and **anon
   public** key into [`js/config.js`](js/config.js). (Not a secret — see the
   comment in that file for why it's safe to commit.)
4. **Authentication → Providers**: confirm **Email** is enabled (it is by
   default on a new project).
5. **Authentication → URL Configuration**: add every URL you'll actually sign
   in from to **Redirect URLs** — your local dev server (e.g.
   `http://localhost:8000/*`) and your real deployed URL (e.g.
   `https://<you>.github.io/icpc-prep-hub/*`). Skipping this makes the magic-
   link *click-through* fail after sending — the 6-digit code the same email
   also contains still works regardless, since it doesn't depend on a
   redirect at all.

That's the whole required setup. Everything below this is optional.

## Codeforces baseline setup (optional)

Builds on the same Supabase project from Account setup above — nothing extra
to create. This unlocks the **Comparison** tiers on the Codeforces page
(Tourist / Top 500 / Top 10,000 / Average user) — see [Codeforces baseline
data](#codeforces-baseline-data) below for what those are and why they need
this.

The only step specific to this feature: deploy and schedule the baseline-
sync job — see [Deploying it](#deploying-it) below. Until that job has run
at least once, the Comparison tiers show "not configured"/empty rather than
fabricating numbers.

### Growing the backend later

`supabase/` is a real [Supabase CLI](https://supabase.com/docs/guides/local-development)
project, not just a one-off SQL file:

- **New tables / schema changes** → add a new file to
  `supabase/migrations/` (e.g. `npx supabase migration new <name>` to
  scaffold one with the right timestamped filename), then
  `npx supabase db push`. Keep old migration files — they're the history of
  how the schema got here, not something to edit after the fact.
- **Server-side logic** (e.g. a scheduled job, or moving Codeforces-handle
  verification server-side — see Known limitations below) → Edge Functions,
  via `npx supabase functions new <name>`, which creates
  `supabase/functions/<name>/index.ts`. Deploy with
  `npx supabase functions deploy <name>`.
- **Actual secrets** used *inside* a function (a service-role key, a
  third-party API key) → `npx supabase secrets set KEY=value` for the
  deployed function, and a local `supabase/functions/.env` for testing with
  `supabase functions serve` — that `.env` file is gitignored
  (`supabase/.gitignore`) and must never be committed. This is different
  from the anon key in `js/config.js`, which is meant to be public.

This isn't hypothetical — `supabase/functions/sync-cf-baseline` (see
[Codeforces baseline data](#codeforces-baseline-data) below) is exactly this
pattern in real use: a migration added its tables, and it's a real deployed
Edge Function, not just a template. Adding the next table or function is
"write a migration / function file and push," not "improvise in the SQL
editor with no history of what changed."

**Known limitations**, honestly stated rather than hidden:

- Codeforces-handle *verification* itself (the compile-error-submission
  check) is judged client-side — there's no server function independently
  re-checking that specific proof. What IS enforced server-side, and matters
  more: a database-level uniqueness constraint
  (`supabase/migrations/20260917000000_cf_handle_uniqueness.sql`) guarantees
  the same handle can never end up verified on two different accounts, and
  every write to your own data is RLS-scoped so no account can read or write
  another's row. The remaining gap is narrow — a determined user could in
  principle call the Supabase REST API directly and mark their own account
  "verified" for a handle without ever completing the real compile-error
  check — but they'd only be fooling their own account's data, not gaining
  access to anyone else's or spoofing a handle someone else already holds.
  Moving the verification check itself server-side (a Supabase Edge
  Function, so the client can't skip it) would close that fully, and is a
  reasonable next step if this ever needs to be airtight rather than honest.
- No compare-and-swap concurrency control on writes — if you somehow edit
  from two devices within the same ~15-second window (see the focus-refetch
  behavior in `js/storage.js`), the later write wins and the earlier one's
  changes are lost. Fine for a single-user personal tracker; not worth the
  complexity of real conflict resolution for how unlikely simultaneous
  multi-device edits actually are here.

## Codeforces baseline data

The Codeforces Analysis page compares your solve count and tag mix against
four tiers: **Tourist** (one specific named player), **Top 500**, **Top
10,000**, and **Average user** (a rating band). This is **not** derived from
the problem set — an earlier version bucketed *problems* by rating as a
proxy for "what a typical player at this tier solves," which produced
numbers that got misread as real solve counts (a "baseline pool" of 1,662
problems is not "the average user solves 1,662 problems"). Every tier's
numbers now come from real players: a large sample (1,500 by default) of real
rated users whose *current rating* falls in that band gets its solve
history fetched and averaged — both the overall solved count and the tag
mix. Tourist is the same technique with a sample size of exactly one, by
name.

**The four cohort tiers additionally require the baseline-sync job to have
actually run at least once** (see [Codeforces baseline
setup](#codeforces-baseline-setup-optional) above) — until then they show
"not configured"/empty. Once populated, they're readable by every signed-in
account with no *extra* permission needed beyond being signed in at all —
`cf_baseline_data`/`cf_percentiles` are public-read tables, same RLS
treatment regardless of which account is asking. The fifth tier, Compare
with someone, doesn't depend on that job at all: it's a live client-side
fetch of one handle's public data, fetched fresh and never stored.

### How it's computed: a daily background job, not a one-off script

Sampling 1,500 real users × 3 tiers means ~4,500 Codeforces API calls, and
Codeforces asks for no more than ~1 request/2s — that's a lot of sequential
waiting, far more than a single Supabase Edge Function invocation is allowed
to run (150s wall-clock time on the free tier, 400s on paid). So this isn't
a script you run once — it's [`supabase/functions/sync-cf-baseline`](supabase/functions/sync-cf-baseline),
an Edge Function that a `pg_cron` job invokes every few minutes. Each
invocation works a time-budgeted batch (~50 users, well under the platform's
wall-clock limit) and checkpoints its progress to a `cf_baseline_sync_state`
table after every single user; the next invocation picks up where the last
one left off. A full daily cycle (refresh rating cutoffs/percentiles +
Tourist, then Top 500, then Top 10,000, then Average user) takes roughly
4-5 hours of these short invocations, then the job goes idle until the next
day. The app reads the finished result from a `cf_baseline_data` table
(public read, write-only via the service role) — never the in-progress
state.

### Deploying it

1. Push the schema (adds `cf_baseline_data`, `cf_percentiles`,
   `cf_baseline_sync_state` — included in
   [`supabase/migrations/`](supabase/migrations)):
   ```bash
   npx supabase db push
   ```
2. Deploy the Edge Function:
   ```bash
   npx supabase functions deploy sync-cf-baseline
   ```
   `supabase/config.toml` sets `verify_jwt = false` for it, since it's meant
   to be invoked by the cron job below rather than a signed-in browser — but
   that also means its URL works for *anyone* who finds it (e.g. by reading
   this repo), not just your cron job. That's low-stakes on its own (it only
   touches public baseline stats and internal job bookkeeping, both protected
   by RLS — see [Codeforces baseline data](#codeforces-baseline-data) above),
   but a stranger repeatedly invoking it still burns your Edge Function quota
   and hammers Codeforces' API through your project's IP. Optionally close
   that off with a shared secret:
   ```bash
   npx supabase secrets set CRON_SYNC_SECRET=$(openssl rand -hex 24)
   ```
   and add the same value as an `x-cron-secret` header on the cron job's
   `net.http_post` call below (`headers := '{"Content-Type": "application/json",
   "x-cron-secret": "<same value>"}'::jsonb`). Unset (the default), the
   function accepts any request, same as before — set it any time, it takes
   effect on the next invocation.
3. Schedule it to run every 3 minutes, in the SQL editor (or via
   `npx supabase db push` if you add this as a migration yourself):
   ```sql
   create extension if not exists pg_cron with schema extensions;
   create extension if not exists pg_net with schema extensions;

   select cron.schedule(
     'sync-cf-baseline-every-3-min',
     '*/3 * * * *',
     $$
     select net.http_post(
       url := 'https://<your-project-ref>.supabase.co/functions/v1/sync-cf-baseline',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     );
     $$
   );
   ```
   Replace `<your-project-ref>` with your actual project ref (from your
   project URL / Settings → General). If you set `CRON_SYNC_SECRET` above,
   add it to `headers` here too, or every cron tick will get a 401.
4. Trigger it once manually to confirm it works before waiting on cron —
   either `npx supabase functions invoke sync-cf-baseline`, or open
   `https://<your-project-ref>.supabase.co/functions/v1/sync-cf-baseline` in
   a browser. Check the response (`{"status": "started new cycle", ...}`)
   and the `cf_baseline_data` table in the Table Editor — invoke it a
   handful more times manually (each call processes one more batch) if you
   don't want to wait for cron to advance it, or just let cron take over
   from here.

Sanity-check once a full cycle completes: the `avgSolvedCount`-equivalent
number in each tier's `windows.allTime` should increase monotonically —
Average user < Top 10,000 < Top 500 < Tourist. If it doesn't, something's
wrong with the sampling.

## Contributing

Contributions are welcome — this is meant to be a community-maintained
resource, not a one-person project.

- The roadmap content lives in [`js/roadmap-data.js`](js/roadmap-data.js) as
  plain data (subjects → phases → topics). Fixing a stale link, tightening a
  "why it matters" note, or adding a missing topic is a small, easy PR.
  Please keep resource links pointed at real, freely-accessible pages
  (cp-algorithms.com, usaco.guide, cses.fi, Codeforces EDU, the ICPC World
  Finals archive, or similarly well-established references).
- App logic is split by concern into small, dependency-free modules under
  `js/` — no build step, no bundler, no homegrown framework (Supabase's
  client SDK, loaded from its CDN build, is the one exception, and only on
  `codeforces.html`):
  - Cross-cutting, loaded on every page: `storage.js`, `dom-utils.js`,
    `theme.js`, `nav.js`, `shell.js` (the shared bootstrap).
  - Codeforces-page-only, backing the baseline comparison feature:
    `config.js`, `supabase-client.js` (see [Codeforces baseline
    data](#codeforces-baseline-data)).
  - Feature modules, loaded only where needed: `roadmap.js` (+
    `roadmap-data.js`), `timeline.js`, `gamification.js`, `cf-sync.js`,
    `cf-verify.js`, `cf-baseline.js` (fetches synced data from Supabase —
    see [Codeforces baseline data](#codeforces-baseline-data)),
    `cf-recommend.js`, `cf-analysis.js`, `cf-team-analysis.js`, `reports.js`,
    `solved-log-ui.js`, `rewards-ui.js`.
  - `js/pages/*.js` — one thin file per page (`home.js`, `dashboard.js`,
    `codeforces.js`, `team.js`, `roadmap.js`, `self-rule.js`) wiring that
    page's forms and handlers.
  - `supabase/functions/sync-cf-baseline` — the one piece of actual
    server-side code in this project (a Deno Edge Function, cron-triggered;
    see [Codeforces baseline data](#codeforces-baseline-data)). Everything
    else genuinely runs client-side.
  Keep it that way; it's what makes this project approachable to clone and
  hack on.
- See [`TODO.md`](TODO.md) for planned features that are deliberately out of
  scope for now — good first issues if you want to pick one up.
- Open a PR or an issue. No formal process beyond that.

## License

[MIT](LICENSE).
