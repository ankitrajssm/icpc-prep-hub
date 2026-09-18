# Planned features

Ideas that are deliberately out of scope for the current version, tracked here
(and/or as GitHub issues) rather than built half-finished.

## Codeforces baseline sync hardening

The baseline data (see [README § Codeforces baseline
data](README.md#codeforces-baseline-data)) is now a real daily background
job — `supabase/functions/sync-cf-baseline`, cron-triggered every few
minutes, sampling 1,500 real users per tier — not a manually-regenerated
static file. A few things are deliberately left for later rather than
over-built now:

- No monitoring/alerting if the cron job silently stops advancing (e.g. CF
  changes their API shape, or the function starts erroring every
  invocation) — you'd only notice by seeing `cf_baseline_data.updated_at`
  go stale. Worth a scheduled check that alerts if it hasn't updated in,
  say, 36 hours.
- Failed per-user fetches within a batch are silently skipped (logged, not
  retried) — if Codeforces has a bad moment during a run, that batch's
  sample is just slightly smaller, not wrong, but there's no backfill.
- The sampling pool is rebuilt from a fresh `user.ratedList` call at every
  phase transition (4 times per cycle) rather than cached once — simple and
  self-correcting, but slightly wasteful.
- This is also the natural place to build a real top-CF-users leaderboard
  someday, since it needs the same kind of scheduled server-side job.

## Other ideas

- Real accounts shipped: magic-link email sign-in (Supabase Auth) + one
  verified Codeforces handle per account, server-stored, synced across every
  device you sign into (see README's "Account setup"). Codeforces-handle
  *verification itself* (the compile-error check) is still judged
  client-side, but a DB-level uniqueness constraint now guarantees the same
  handle can never be verified on two accounts — see README's "Known
  limitations" for the honest remaining gap and what closing it fully would
  take (an Edge Function re-checking the proof server-side). Worth doing if
  a future feature ever shows one user's claimed/verified handle to another
  (e.g. a leaderboard) — nothing today does. (The Team Analyzer's 3-handle
  comparison doesn't trigger this either — it only shows public Codeforces
  data fetched live, the same as Compare with someone, never this app's own
  verification/points state.)
- Map raw Codeforces tags (`dp`, `binary search`, `number theory`, etc.) to
  the 99 roadmap topics, so weak-tag call-outs (Codeforces Analysis, the
  Team Analyzer's team-gap list) can link straight to "practice this roadmap
  topic" instead of just naming the raw tag. Checked this while building the
  Team Analyzer — no such mapping exists today, and topic `id`/`name`
  strings only cleanly match real CF tags in a handful of cases (most are
  compound/differently-phrased, e.g. topic "Bitmask DP" vs. tag `bitmasks`),
  so it needs real curation across all 99 topics, not a naive string match.
- Contest-type breakdown (Div1/Div2/Div3/Educational/Global performance
  shown separately) — some people do well in practice but underperform live,
  or vice versa.
- Rating milestone projection — a rough trend-line extrapolation, clearly
  caveated as a rough estimate, not a guarantee.
- PWA/offline support (service worker + manifest) so the app installs and
  works without a network connection at all.
- Per-subject custom pacing weights (e.g. let the user say "I already know
  most of Math, weight it lower") instead of pure topic-count proportionality.
- Configurable point-formula constants (base divisor, focus multiplier,
  minimum) via the profile card instead of fixed constants in code.
- Solve-velocity-aware fallback timeline estimate (use actual recent pace
  instead of the fixed default-topics/week assumption) once checklist changes
  are timestamped.
- Optional CSV export of the solved log for spreadsheet users.
