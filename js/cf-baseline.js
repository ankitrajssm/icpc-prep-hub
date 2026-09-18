/**
 * Compares your own solved-tag ratios against real-player-sampled baseline data synced
 * daily by a Supabase Edge Function (see supabase/functions/sync-cf-baseline and README
 * "Codeforces baseline data"). Fetched live from the `cf_baseline_data` / `cf_percentiles`
 * tables — public-read, no sign-in needed, but this deployment must have Supabase
 * configured (see js/config.js); there's no local/offline fallback for the cohort tiers
 * specifically, since that data genuinely can't be computed client-side. The one-off
 * "compare with a specific handle" mode (compareWithHandleProblems) is the fully-local-
 * friendly alternative — it's just a public API fetch, no server-side data needed.
 * Rendered by js/cf-analysis.js.
 */
const CF_BASELINE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const CF_BASELINE_MIN_SOLVES = 5;
// Below this expected count, the baseline sample (only ~10 real players) has almost no signal
// for this tag — dividing by a near-zero denominator would blow any nonzero solve up into a
// meaningless "Excellent". Below this, don't compute a ratio at all; say so instead.
const CF_BASELINE_MIN_EXPECTED = 0.5;
// Laplace/additive smoothing added to both sides of the ratio: r = (yourCount + K) / (expectedCount + K).
// Without this, a tiny sample on either side produces wild, overconfident ratios — "1 solve vs
// an average of 0.6" is technically r=1.67 ("Strong") from 1 data point, not real evidence. Adding
// K "phantom" solves to both sides pulls small samples toward On-Par (r=1) and only lets a verdict
// swing to Strong/Excellent once you've actually solved enough in that tag to trust it.
const CF_BASELINE_SMOOTHING_K = 5;

function cfBaselineCleanTags(tags) {
  return (tags || []).filter((t) => !t.startsWith("*"));
}

/**
 * Classifies yourCount against expectedCount (= baselineRatio * yourTotal — the count you'd
 * have if you matched the baseline's tag mix exactly). R = (yourCount + K) / (expectedCount + K)
 * — see CF_BASELINE_SMOOTHING_K — is the single normalized signal driving both the verdict band
 * and the color hue.
 *
 *   R <  0.3           Very Weak
 *   0.3 <= R < 0.6      Weak
 *   0.6 <= R < 1.25     On-Par
 *   1.25 <= R < 2.0     Strong
 *   R >= 2.0            Excellent
 *
 * Zero solves in a tag that's part of the baseline gets its own friendly verdict rather than
 * being lumped in with "Very Weak" — you haven't failed at it, you just haven't started.
 * A too-rare baseline (see CF_BASELINE_MIN_EXPECTED) also gets its own neutral verdict rather
 * than a fabricated ratio — an unreliable denominator, not a real signal either way.
 */
function cfBaselineClassify(yourCount, expectedCount) {
  if (yourCount === 0) return { verdict: "start", label: "Just Start Buddy", r: 0 };
  if (expectedCount < CF_BASELINE_MIN_EXPECTED) return { verdict: "rare", label: "Rare Tag — No Baseline", r: null };
  const r = (yourCount + CF_BASELINE_SMOOTHING_K) / (expectedCount + CF_BASELINE_SMOOTHING_K);
  if (r < 0.3) return { verdict: "very-weak", label: "Very Weak", r };
  if (r < 0.6) return { verdict: "weak", label: "Weak", r };
  if (r < 1.25) return { verdict: "on-par", label: "On-Par", r };
  if (r < 2.0) return { verdict: "strong", label: "Strong", r };
  return { verdict: "excellent", label: "Excellent", r };
}

/**
 * Gradual red -> yellow -> green hue for a given R (weak -> average -> strong), continuous
 * but anchored to the verdict band boundaries so each band actually reads as its intended
 * color (a naive linear 0-2 -> 0-120 map washes "Weak" out to yellow-green instead of red).
 */
const CF_BASELINE_HUE_POINTS = [
  [0, 0], // Very Weak: red
  [0.3, 15], // Very Weak/Weak boundary: red-orange
  [0.6, 35], // Weak/On-Par boundary: orange
  [1.0, 55], // On-Par center ("average"): yellow
  [1.25, 85], // On-Par/Strong boundary: yellow-green
  [2.0, 120], // Strong/Excellent boundary: green
  [2.5, 135], // Excellent: deeper green
];

function cfBaselineHue(r) {
  const clamped = Math.max(0, Math.min(2.5, r));
  for (let i = 0; i < CF_BASELINE_HUE_POINTS.length - 1; i++) {
    const [r0, h0] = CF_BASELINE_HUE_POINTS[i];
    const [r1, h1] = CF_BASELINE_HUE_POINTS[i + 1];
    if (clamped <= r1) return h0 + ((clamped - r0) / (r1 - r0)) * (h1 - h0);
  }
  return CF_BASELINE_HUE_POINTS[CF_BASELINE_HUE_POINTS.length - 1][1];
}

const CFBaseline = {
  _tiers: null, // { [tierId]: { label, ratingCutoff, windows } }, once loaded
  _percentiles: null,
  _loadPromise: null,

  /** True once tiers+percentiles have been successfully fetched this page session. */
  isLoaded() {
    return this._tiers !== null;
  },

  /** Fetches cf_baseline_data + cf_percentiles from Supabase (once; cached for the session). Requires cloud mode. */
  async ensureLoaded() {
    if (this._tiers) return;
    if (!CLOUD_ENABLED) throw new Error("Cloud sync isn't configured.");
    if (!this._loadPromise) {
      this._loadPromise = (async () => {
        const [tiersRes, pctRes] = await Promise.all([
          supabaseClient.from("cf_baseline_data").select("*"),
          supabaseClient.from("cf_percentiles").select("percentiles").eq("id", true).maybeSingle(),
        ]);
        if (tiersRes.error) throw tiersRes.error;
        if (!tiersRes.data || !tiersRes.data.length) throw new Error("No baseline data synced yet — check back soon.");
        const tiers = {};
        for (const row of tiersRes.data) {
          tiers[row.tier] = { label: row.label, ratingCutoff: row.rating_cutoff, windows: row.windows };
        }
        this._tiers = tiers;
        this._percentiles = pctRes.data ? pctRes.data.percentiles : {};
      })();
    }
    try {
      await this._loadPromise;
    } catch (e) {
      this._loadPromise = null; // allow retry on next call
      throw e;
    }
  },

  /** "allTime" -> no cutoff; "lastYear" -> ISO cutoff 1 year ago. */
  windowCutoffISO(window) {
    return window === "lastYear" ? new Date(Date.now() - CF_BASELINE_YEAR_MS).toISOString() : null;
  },

  /** { total, counts: {tag: count}, ratios: {tag: ratio} } for an arbitrary list of {tags} entries. */
  tagRatiosFromEntries(entries) {
    const total = entries.length;
    const counts = {};
    for (const p of entries) {
      for (const tag of cfBaselineCleanTags(p.tags)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    const ratios = {};
    for (const [tag, count] of Object.entries(counts)) ratios[tag] = count / total;
    return { total, counts, ratios };
  },

  /** { total, counts: {tag: count}, ratios: {tag: ratio} } for the user's own solvedLog in the given window. */
  yourTagRatios(window) {
    const cutoff = this.windowCutoffISO(window);
    const entries = Store.data.solvedLog.filter((p) => !cutoff || p.solvedDate >= cutoff);
    return this.tagRatiosFromEntries(entries);
  },

  /** Per-tag comparison rows for the given tier ("tourist"|"top500"|"top10000"|"average") and window ("allTime"|"lastYear"). Call ensureLoaded() first. */
  compareTags({ tier, window }) {
    const tierData = this._tiers[tier];
    const baselineWindow = tierData.windows[window];
    const yours = this.yourTagRatios(window);

    const allTags = new Set([...Object.keys(baselineWindow.tagRatios), ...Object.keys(yours.ratios)]);
    const rows = [...allTags].map((tag) => {
      const yourRatio = yours.ratios[tag] || 0;
      const yourCount = yours.counts[tag] || 0;
      const baselineRatio = baselineWindow.tagRatios[tag] || 0;
      const expectedCount = baselineRatio * yours.total;
      const { verdict, label, r } = cfBaselineClassify(yourCount, expectedCount);
      const hue = r === null ? null : cfBaselineHue(r);
      // Their own real (whole-number) solved count in this tag, recovered from the stored
      // ratio times their own total — NOT expectedCount (which is rescaled onto YOUR total, so
      // it's only meaningful as "what you'd need to match them," and is fractional even for the
      // Tourist tier, where the "baseline" is one specific real person who can't have solved a
      // fractional number of problems). Only rendered for the Tourist tier (see cf-analysis.js
      // renderBaseline) — the sampled cohorts (Top 500/10,000/Average) are real population
      // averages across ~1500 players, where a fractional "average solved" figure is honest and
      // expected, so they keep showing expectedCount.
      const theirCount = Math.round(baselineRatio * baselineWindow.problemCount);
      return { tag, yourRatio, yourCount, baselineRatio, expectedCount, theirCount, verdict, verdictLabel: label, r, hue };
    });
    rows.sort((a, b) => b.baselineRatio - a.baselineRatio);

    return {
      rows,
      yourTotal: yours.total,
      insufficientData: yours.total < CF_BASELINE_MIN_SOLVES,
      tierLabel: tierData.label,
      ratingCutoff: tierData.ratingCutoff,
      avgSolvedCount: baselineWindow.problemCount,
      sampleSize: baselineWindow.sampleSize,
    };
  },

  /**
   * Fetches one specific Codeforces handle's live public solve history — not stored anywhere
   * (never touches your own solvedLog or points, purely read-only for comparison). Works even
   * in a fully local-only deployment with no Supabase project at all, unlike the cohort tiers,
   * since it's just a client-side fetch of public data instead of the server-synced baseline.
   * Resolves { ok, problems } or
   * { ok: false, error }; cache the `problems` and pass to compareWithHandleProblems() so
   * switching the last-year/all-time window doesn't require re-fetching.
   */
  async fetchHandleProblems(handle) {
    const result = await CFSync.fetchLive(handle);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, problems: result.problems };
  },

  /** Pure (no fetch) per-tag comparison against an already-fetched handle's problems, for the given window. */
  compareWithHandleProblems({ handle, problems, window }) {
    const cutoff = this.windowCutoffISO(window);
    const theirEntries = problems.filter((p) => !cutoff || p.solvedDate >= cutoff);
    const theirs = this.tagRatiosFromEntries(theirEntries);
    const yours = this.yourTagRatios(window);

    if (!theirs.total) {
      return { ok: false, error: `${handle} has no solves in this window yet.` };
    }

    const allTags = new Set([...Object.keys(theirs.ratios), ...Object.keys(yours.ratios)]);
    const rows = [...allTags].map((tag) => {
      const yourRatio = yours.ratios[tag] || 0;
      const yourCount = yours.counts[tag] || 0;
      const baselineRatio = theirs.ratios[tag] || 0;
      const expectedCount = baselineRatio * yours.total;
      const { verdict, label, r } = cfBaselineClassify(yourCount, expectedCount);
      const hue = r === null ? null : cfBaselineHue(r);
      // theirCount is their real, whole-number solve count in this tag — distinct from
      // expectedCount (their ratio rescaled onto *your* total), which is what actually drives
      // the verdict math but looks wrong printed next to a specific named player (e.g. "94.3
      // jiangly" — jiangly obviously didn't solve a fractional number of problems).
      const theirCount = theirs.counts[tag] || 0;
      return { tag, yourRatio, yourCount, baselineRatio, expectedCount, theirCount, verdict, verdictLabel: label, r, hue };
    });
    rows.sort((a, b) => b.baselineRatio - a.baselineRatio);

    return {
      ok: true,
      rows,
      yourTotal: yours.total,
      theirTotal: theirs.total,
      theirHandle: handle,
      insufficientData: yours.total < CF_BASELINE_MIN_SOLVES,
    };
  },

  /** Smallest p (1-99) such that a rating this high clears the "top p%" cutoff, or null without a rating or unloaded data. */
  percentileForRating(rating) {
    if (rating == null || !this._percentiles) return null;
    for (let p = 1; p <= 99; p++) {
      if (this._percentiles[p] <= rating) return p;
    }
    return 99;
  },
};
