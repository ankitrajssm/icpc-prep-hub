/**
 * Codeforces sync: try a direct client-side fetch to the CF API first (it
 * generally allows CORS), and fall back to a manual "open in new tab, paste
 * JSON here" flow if the fetch fails for any reason (network, CORS, rate
 * limit). Also exposes a single-problem manual log helper.
 *
 * Every submission fetch (live or pasted) also derives two extra pieces of
 * analysis from the same raw list, at zero extra API cost: how many wrong
 * attempts preceded each eventual AC, and which problems were attempted but
 * never solved. Rating trajectory is the one genuinely separate CF endpoint
 * (`user.rating`), fetched as a best-effort second step during sync.
 */
const CFSync = {
  apiUrl(handle) {
    return `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`;
  },

  ratingApiUrl(handle) {
    return `https://codeforces.com/api/user.rating?handle=${encodeURIComponent(handle)}`;
  },

  /** Turn a CF API `result` array into our internal problem shape, OK verdicts only. */
  extractSolved(submissions) {
    const seen = new Set();
    const out = [];
    for (const sub of submissions) {
      if (sub.verdict !== "OK") continue;
      const p = sub.problem;
      const key = Gamification.problemKey(p.contestId, p.index);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        contestId: p.contestId ?? null,
        index: p.index ?? null,
        name: p.name || key,
        rating: p.rating ?? null,
        tags: p.tags || [],
        solvedDate: new Date(sub.creationTimeSeconds * 1000).toISOString(),
        source: "cf-sync",
      });
    }
    return out;
  },

  /** Wrong-attempt counts, keyed by problem key, only for problems that do have an eventual OK. */
  deriveAttemptStats(submissions) {
    const byKey = new Map(); // key -> { hasOK, wrongCount }
    for (const sub of submissions) {
      const p = sub.problem;
      const key = Gamification.problemKey(p.contestId, p.index);
      const rec = byKey.get(key) || { hasOK: false, wrongCount: 0 };
      if (sub.verdict === "OK") rec.hasOK = true;
      else rec.wrongCount++;
      byKey.set(key, rec);
    }
    const out = {};
    for (const [key, rec] of byKey) {
      if (rec.hasOK && rec.wrongCount > 0) out[key] = rec.wrongCount;
    }
    return out;
  },

  /** Distinct problems with >=1 submission and no OK, newest-attempt-first, capped to 100. */
  deriveUnsolvedAttempted(submissions) {
    const byKey = new Map();
    for (const sub of submissions) {
      const p = sub.problem;
      const key = Gamification.problemKey(p.contestId, p.index);
      const rec =
        byKey.get(key) ||
        {
          key,
          contestId: p.contestId ?? null,
          index: p.index ?? null,
          name: p.name || key,
          rating: p.rating ?? null,
          tags: p.tags || [],
          hasOK: false,
          attemptCount: 0,
          lastAttemptMs: 0,
        };
      if (sub.verdict === "OK") rec.hasOK = true;
      rec.attemptCount++;
      rec.lastAttemptMs = Math.max(rec.lastAttemptMs, sub.creationTimeSeconds * 1000);
      byKey.set(key, rec);
    }
    return [...byKey.values()]
      .filter((r) => !r.hasOK)
      .sort((a, b) => b.lastAttemptMs - a.lastAttemptMs)
      .slice(0, 100)
      .map(({ hasOK, lastAttemptMs, ...rest }) => ({ ...rest, lastAttemptDate: new Date(lastAttemptMs).toISOString() }));
  },

  /** Attempt the live fetch. Resolves { ok: true, problems, attemptStats, unsolvedAttempted } or { ok: false, error }. */
  async fetchLive(handle) {
    try {
      const res = await fetch(this.apiUrl(handle));
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }
      const json = await res.json();
      if (json.status !== "OK") {
        return { ok: false, error: json.comment || "Codeforces API returned an error" };
      }
      return {
        ok: true,
        problems: this.extractSolved(json.result),
        attemptStats: this.deriveAttemptStats(json.result),
        unsolvedAttempted: this.deriveUnsolvedAttempted(json.result),
      };
    } catch (e) {
      return { ok: false, error: e.message || "Network/CORS error" };
    }
  },

  /**
   * Like fetchLive, but returns the raw submissions array untouched instead of pre-processing
   * it — needed by js/cf-team-analysis.js for fields fetchLive's processing discards, namely
   * `author.participantType` and `relativeTimeSeconds` (used to derive live-contest solve speed).
   */
  async fetchRawSubmissions(handle) {
    try {
      const res = await fetch(this.apiUrl(handle));
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = await res.json();
      if (json.status !== "OK") return { ok: false, error: json.comment || "Codeforces API returned an error" };
      return { ok: true, submissions: json.result };
    } catch (e) {
      return { ok: false, error: e.message || "Network/CORS error" };
    }
  },

  /** Parse manually-pasted JSON (either the raw `result` array, or the full `{status, result}` envelope). */
  parseManual(jsonText) {
    const parsed = JSON.parse(jsonText);
    const submissions = Array.isArray(parsed) ? parsed : parsed.result;
    if (!Array.isArray(submissions)) {
      throw new Error("Couldn't find a submissions array in that JSON.");
    }
    return {
      problems: this.extractSolved(submissions),
      attemptStats: this.deriveAttemptStats(submissions),
      unsolvedAttempted: this.deriveUnsolvedAttempted(submissions),
    };
  },

  /** Best-effort second sync step: contest-by-contest rating history. Separate CF endpoint. */
  async fetchRatingHistory(handle) {
    try {
      const res = await fetch(this.ratingApiUrl(handle));
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = await res.json();
      if (json.status !== "OK") return { ok: false, error: json.comment || "Codeforces API returned an error" };
      const history = json.result.map((r) => ({
        contestId: r.contestId,
        contestName: r.contestName,
        ratingUpdateTimeSeconds: r.ratingUpdateTimeSeconds,
        oldRating: r.oldRating,
        newRating: r.newRating,
      }));
      return { ok: true, history };
    } catch (e) {
      return { ok: false, error: e.message || "Network/CORS error" };
    }
  },

  /** Full sync pipeline given already-extracted problems: dedupe against the store and log the rest. */
  applyProblems(problems) {
    return Gamification.addSolves(problems);
  },

  applyAnalysis({ attemptStats, unsolvedAttempted }) {
    Store.update((d) => {
      d.cf.attemptStats = attemptStats;
      d.cf.unsolvedAttempted = unsolvedAttempted;
    });
  },

  applyRatingHistory(history) {
    Store.update((d) => {
      d.cf.ratingHistory = history;
      d.cf.lastRatingSyncAt = new Date().toISOString();
    });
  },

  /**
   * Manual single-solve entry. No submission history to derive analysis from.
   *
   * The dedup key for a contestId+index pair is that pair (as everywhere else); without one,
   * it's derived from the normalized name instead of a timestamp — a timestamp-based key made
   * every click of "Log solve" (even with identical, blank-contest input) generate a brand-new
   * key, which addSolves' key-based dedup can never catch, letting a single button spammed
   * repeatedly earn unlimited points.
   */
  logSingle({ contestId, index, name, rating, tags, solvedDate }) {
    const normalizedName = (name || "").trim().toLowerCase();
    const key = contestId && index ? Gamification.problemKey(contestId, index) : `manual-${normalizedName || "untitled"}`;
    return Gamification.addSolves([
      {
        key,
        contestId: contestId || null,
        index: index || null,
        name: name || key,
        rating: rating || null,
        tags: tags || [],
        solvedDate,
        source: "manual",
      },
    ]);
  },
};
