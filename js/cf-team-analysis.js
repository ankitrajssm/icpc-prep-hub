/**
 * ICPC Team Analyzer: fetches up to 3 Codeforces handles' public data live (nothing stored,
 * nothing synced — same trust model as the Codeforces page's "Compare with someone" tier) and
 * builds a comparative analysis: per-member summary, team-wide tag gaps, a suggested
 * Reader/Coder/Thinker role split plus a Math/Graphs-DS/Geometry-Strings domain split, and
 * non-topic signals (accuracy/bug-rate, live-contest solve speed).
 *
 * The role/domain model and the tag buckets behind it are grounded in real ICPC coaching
 * literature, not invented from scratch — see README's "ICPC Team Analyzer" section for the
 * sources (Neel Mishra's "ICPC Team Strategy"; the KTH contest-wiki "Team strategy" page; and
 * Codeforces' own "Rating the Difficulty of Codeforces Problems" for the reach/ceiling metric
 * and for the per-topic rating methodology below).
 *
 * Two deliberate methodology choices worth calling out (both found by testing against real
 * lopsided teams, not designed upfront):
 *  - Strength-in-a-topic is measured as a per-topic RATING (the average Codeforces difficulty of
 *    the problems solved in that topic — the same number space as a player's own rating), not a
 *    solve-count RATIO. A ratio conflates "how much I practice this" with "how good I am at it"
 *    — someone can rack up a high ratio solving 100 easy problems in a tag while someone else
 *    solves 20 hard ones in it and is clearly stronger. See topicRatings()/topicRatingAvg().
 *  - Reader breadth is computed over each member's most RECENT solves (READER_RECENT_WINDOW),
 *    not their lifetime history. A player with thousands of career solves will have mechanically
 *    touched nearly every tag in existence just from sheer volume, which made the highest-volume
 *    player look like the best "generalist" regardless of whether that's true — a sample-size
 *    artifact, not a real signal. See recentTagCounts().
 * Reader breadth itself uses Pielou's evenness index, a standard diversity-index technique.
 *
 * "Insights" here are a deterministic template built from the real computed numbers, not a live
 * AI call — an LLM API key can't be safely embedded in this site's client-side JS the way the
 * Supabase anon key can (Row Level Security protects that one; no LLM provider has an equivalent
 * guard over token spend), and a grounded template can't hallucinate a plausible-sounding but
 * wrong insight. See README for the reasoning if a real-LLM version is ever wanted later.
 */

/**
 * Min-max normalizes `values` (one number per member, or null for "no data") to 0..1, only
 * across entries that aren't null. Fewer than 2 present entries can't be meaningfully ranked, so
 * everyone gets a neutral 0.5 instead of an arbitrary 0 or 1 — this is what stops a member with
 * no live-contest submissions (or no rated solves) from being unfairly zeroed out of a role that
 * partly depends on that signal; their score there just falls back to whatever data they do have.
 */
function normalizeValues(values) {
  const present = values.map((v, i) => ({ i, v })).filter((x) => x.v != null);
  const out = new Array(values.length).fill(0.5);
  if (present.length < 2) return out;
  const vals = present.map((x) => x.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  for (const x of present) out[x.i] = max > min ? (x.v - min) / (max - min) : 0.5;
  return out;
}

const TeamAnalysis = {
  _members: null, // set by a successful analyze() call; render() reads from here

  // "Standard technique" tags a strong Coder should knock out fast and cleanly — greedy,
  // straightforward implementation, basic simulation. The complement (THINKER_TAGS) is what
  // calls for real insight. This split mirrors how ICPC coaching literature actually separates
  // "problem-solving" skill from "implementation" skill as two different axes, not one scale.
  CODER_TAGS: ["implementation", "brute force", "constructive algorithms", "sortings", "two pointers", "binary search", "greedy"],
  THINKER_TAGS: [
    "dp", "graphs", "trees", "data structures", "dsu", "number theory", "combinatorics", "math",
    "geometry", "probabilities", "games", "divide and conquer", "fft", "shortest paths", "strings",
    "bitmasks", "dfs and similar",
  ],
  // Evaluated for "team gap" flagging — exists only to avoid flagging a legitimately rare tag
  // (e.g. "chinese remainder theorem") as a weakness just because nobody's solved much of it,
  // which is normal, not a real gap.
  get CORE_TAGS() {
    return [...this.CODER_TAGS, ...this.THINKER_TAGS, "hashing"];
  },

  // Topic-ownership domains — a second, independent axis from ROLES below. Real ICPC teams
  // assign both: a workflow role (who reads/codes/thinks) AND domain ownership (who takes any
  // problem that's clearly math, clearly graphs, etc.), and the two don't have to line up.
  DOMAINS: [
    { id: "math", label: "Math & Number Theory", tags: ["math", "number theory", "combinatorics", "probabilities", "fft", "matrices", "chinese remainder theorem"] },
    { id: "graphs-ds", label: "Graphs & Data Structures", tags: ["graphs", "trees", "dsu", "data structures", "shortest paths", "divide and conquer", "flows", "2-sat", "graph matchings"] },
    { id: "geometry-strings", label: "Geometry & Strings", tags: ["geometry", "strings", "string suffix structures", "hashing"] },
  ],

  // Reader/Coder/Thinker: the standard 3-person ICPC role split (see file header for sources).
  ROLES: [
    { id: "reader", label: "Reader", blurb: "Reads fastest, spots the easy problems, classifies the rest by topic" },
    { id: "coder", label: "Coder", blurb: "Fastest, cleanest implementer of standard-technique problems" },
    { id: "thinker", label: "Thinker", blurb: "Cracks the hardest, most insight-heavy problems" },
  ],
  ASSIGNMENT_PERMS: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]],

  // Same CF rank-tier table as CFAnalysis.RANK_TITLES, duplicated rather than pulling in all of
  // cf-analysis.js (~500 lines tied to Store.data/Codeforces-page DOM ids) just for this stable
  // 10-line constant.
  RANK_TITLES: [
    [3000, "Legendary Grandmaster"],
    [2600, "International Grandmaster"],
    [2400, "Grandmaster"],
    [2300, "International Master"],
    [2100, "Master"],
    [1900, "Candidate Master"],
    [1600, "Expert"],
    [1400, "Specialist"],
    [1200, "Pupil"],
    [0, "Newbie"],
  ],

  FETCH_RETRIES: 2, // extra attempts after the first, only for retryable (rate-limit/transient) failures
  RETRY_DELAY_MS: 1500,
  HANDLE_STAGGER_MS: 400, // gap before starting the next handle's fetches, on top of full sequencing below

  MIN_CONTEST_SOLVES_FOR_SPEED: 5,
  MIN_TAG_SAMPLE: 2,
  MIN_TOPIC_RATING_SAMPLE: 3, // fewer rated solves in a tag than this = not shown at all, no signal whatsoever
  TAG_RATING_RECENT_WINDOW: 30, // per-tag rating averages only the member's most recent this-many solves IN that tag
  TAG_RATING_LOW_CONFIDENCE_SAMPLE: 10, // fewer solves than this actually going into the average = shown, but flagged as noisy
  READER_RECENT_WINDOW: 150, // Reader breadth looks at only this many of a member's MOST RECENT solves — see file header
  KNOWLEDGE_GAP_RATIO_CUTOFF: 0.03,
  EXECUTION_GAP_MIN_COUNT: 6,
  EXECUTION_GAP_ACCURACY_CUTOFF: 60,
  TEAM_GAP_MAX_SHOWN: 6,
  IMPLEMENTATION_WATCH_TAGS: ["implementation", "brute force", "constructive algorithms"],
  IMPLEMENTATION_GAP_PTS: 15,
  REACH_TOP_N: 10, // how many of a member's hardest solves define their "ceiling"
  REACH_MIN_SAMPLE: 3, // below this many rated solves, reach isn't a meaningful signal
  TAG_RATING_MIN: 800, // fixed scale for the tag-rating bar chart (real CF rating floor/ceiling),
  TAG_RATING_MAX: 3500, // so bar width is comparable across tags/members, not re-normalized per row

  rankTitle(rating) {
    if (rating == null) return null;
    for (const [cutoff, title] of this.RANK_TITLES) {
      if (rating >= cutoff) return title;
    }
    return null;
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Codeforces' API rate-limits bursts of concurrent requests — firing all 3 handles' fetches at
   * once (this app used to) reliably produced two different-looking symptoms of the same root
   * cause: the whole analyze() call failing outright (a 429/503 on one of the requests), or a
   * *specific* member quietly showing "unrated" because only their rating-history call got
   * rate-limited while their submissions call happened to succeed (fetchMemberData previously
   * treated a failed rating fetch as "this person just has no rated history" instead of "this
   * request failed"). Retrying a couple of times before giving up fixes both — but only for
   * failures that look transient (rate-limit/server-hiccup HTTP codes, or a generic network
   * error); a permanent failure like "handle not found" (HTTP 400) is retried for nothing, so
   * fail fast there instead of making the user wait through pointless retries.
   */
  async fetchWithRetry(fetchFn) {
    let result;
    for (let attempt = 0; attempt <= this.FETCH_RETRIES; attempt++) {
      result = await fetchFn();
      if (result.ok) return result;
      const transient = /HTTP (429|503|502|504)/.test(result.error || "") || /network|fetch/i.test(result.error || "");
      if (!transient || attempt === this.FETCH_RETRIES) return result;
      await this.sleep(this.RETRY_DELAY_MS);
    }
    return result;
  },

  /** One handle's full picture: solved problems, tag ratios/ratings, accuracy, live-contest speed, rating. */
  async fetchMemberData(handle) {
    const subsResult = await this.fetchWithRetry(() => CFSync.fetchRawSubmissions(handle));
    if (!subsResult.ok) return { handle, ok: false, error: subsResult.error };
    const ratingResult = await this.fetchWithRetry(() => CFSync.fetchRatingHistory(handle));
    if (!ratingResult.ok) return { handle, ok: false, error: `rating history: ${ratingResult.error}` };
    const submissions = subsResult.submissions;
    const problems = CFSync.extractSolved(submissions);
    const attemptStats = CFSync.deriveAttemptStats(submissions);
    const tagStats = CFBaseline.tagRatiosFromEntries(problems);
    const topicRatings = this.topicRatings(problems);
    const speed = this.computeSolveSpeed(submissions);
    const accuracyByTag = this.computeAccuracyByTag(problems, attemptStats);
    const overallAccuracy = this.computeOverallAccuracy(problems, attemptStats);
    const currentRating = ratingResult.history.length ? ratingResult.history[ratingResult.history.length - 1].newRating : null;
    return { handle, ok: true, problems, tagStats, topicRatings, speed, accuracyByTag, overallAccuracy, currentRating, totalSolved: problems.length };
  },

  /**
   * Live-contest solve speed — the "slow submission time" ask. Only counts submissions made
   * DURING a real contest (participantType "CONTESTANT"), so someone who only virtual-
   * participates or upsolves will legitimately show "not enough data" here, not a fabricated
   * number. Reports the median (not mean) minutes-to-AC across a member's earliest AC per
   * problem, since a single very-late solve shouldn't skew the whole picture.
   */
  computeSolveSpeed(submissions) {
    const bestByProblem = new Map();
    for (const sub of submissions) {
      if (sub.verdict !== "OK") continue;
      if (!sub.author || sub.author.participantType !== "CONTESTANT") continue;
      if (typeof sub.relativeTimeSeconds !== "number" || sub.relativeTimeSeconds < 0) continue;
      const key = Gamification.problemKey(sub.problem.contestId, sub.problem.index);
      const prev = bestByProblem.get(key);
      if (prev === undefined || sub.relativeTimeSeconds < prev) bestByProblem.set(key, sub.relativeTimeSeconds);
    }
    const minutes = [...bestByProblem.values()].map((s) => s / 60).sort((a, b) => a - b);
    if (minutes.length < this.MIN_CONTEST_SOLVES_FOR_SPEED) return { insufficientData: true, sampleSize: minutes.length };
    const mid = Math.floor(minutes.length / 2);
    const medianMinutes = minutes.length % 2 ? minutes[mid] : (minutes[mid - 1] + minutes[mid]) / 2;
    return { insufficientData: false, medianMinutes, sampleSize: minutes.length };
  },

  /** Per-tag accuracy, same formula as CFAnalysis.renderAccuracy — count/(count+totalWrong). */
  computeAccuracyByTag(problems, attemptStats) {
    const tagStats = {};
    for (const p of problems) {
      const wrong = attemptStats[p.key] || 0;
      for (const tag of p.tags || []) {
        if (!tagStats[tag]) tagStats[tag] = { totalWrong: 0, count: 0 };
        tagStats[tag].totalWrong += wrong;
        tagStats[tag].count += 1;
      }
    }
    const out = {};
    for (const [tag, s] of Object.entries(tagStats)) {
      if (s.count < this.MIN_TAG_SAMPLE) continue;
      out[tag] = { accuracyPct: (s.count / (s.count + s.totalWrong)) * 100, count: s.count, totalWrong: s.totalWrong };
    }
    return out;
  },

  /** Single aggregate accuracy number across all solved problems, or null with zero solves. */
  computeOverallAccuracy(problems, attemptStats) {
    if (!problems.length) return null;
    let count = 0;
    let totalWrong = 0;
    for (const p of problems) {
      count++;
      totalWrong += attemptStats[p.key] || 0;
    }
    return { accuracyPct: (count / (count + totalWrong)) * 100, count, totalWrong };
  },

  /**
   * Team-wide headline numbers, shown up front so "Team insights" doesn't open straight into a
   * bare gap list — average/spread of rating (spread flags a very lopsided team early), one
   * combined accuracy figure (aggregated from raw counts across all 3 members, not an average of
   * percentages, which would misweight whoever has fewer solves), and how much of the app's core
   * ICPC tag list the team has touched at all vs. never gone near.
   */
  computeTeamStats(members) {
    const ratings = members.map((m) => m.currentRating).filter((r) => r != null);
    const avgRating = ratings.length ? Math.round(ratings.reduce((s, r) => s + r, 0) / ratings.length) : null;
    const ratingSpread = ratings.length >= 2 ? Math.max(...ratings) - Math.min(...ratings) : null;
    let count = 0;
    let totalWrong = 0;
    for (const m of members) {
      if (!m.overallAccuracy) continue;
      count += m.overallAccuracy.count;
      totalWrong += m.overallAccuracy.totalWrong;
    }
    const combinedAccuracy = count ? (count / (count + totalWrong)) * 100 : null;
    const tagsCovered = this.CORE_TAGS.filter((tag) => members.some((m) => (m.tagStats.counts[tag] || 0) > 0)).length;
    return { avgRating, ratingSpread, combinedAccuracy, tagsCovered, totalCoreTags: this.CORE_TAGS.length };
  },

  /**
   * Per-tag STRENGTH, not practice volume: a rating-WEIGHTED average Codeforces rating of the
   * problems a member has solved that carry each tag — the same number space as a player's own
   * rating, so "Math & Number Theory: ~2800" reads exactly like a rating. This is deliberately
   * NOT a solve-count ratio (see file header) — a ratio only tells you how much of someone's
   * practice concentrated on a tag, not how hard a problem in it they can actually solve. Gated
   * by MIN_TOPIC_RATING_SAMPLE per tag so a tag touched only once or twice doesn't produce a
   * noisy "rating" off a single data point.
   *
   * Weighted, not a plain mean, because a plain mean has a real failure mode: someone who
   * ground 100 problems at 800 early on and has since improved to solving 1700-1800s in the same
   * tag would still average out to ~1200-1300 — nowhere near their actual current level, just
   * because the old volume outnumbers the new. Weighting each solve's contribution by the SQUARE
   * of its own rating (so a 1700 counts roughly 4.5x more than an 800, not just ~2x) pulls the
   * number meaningfully toward what they can *currently* solve — but for a tag with a LOT of
   * lifetime volume, weighting alone isn't always enough: a huge pile of old easy solves can still
   * outweigh a smaller pile of recent hard ones even after squaring. So on top of the weighting,
   * only each tag's most recent TAG_RATING_RECENT_WINDOW solves (sorted by solve date, not
   * lifetime order) go into the average at all — the same "recency beats lifetime volume" fix
   * already applied to Reader breadth (see file header/recentTagCounts), just scoped per tag
   * instead of globally. This also fixes the opposite failure mode: a tag you've barely touched
   * (all of it recent, since you never built up an old backlog in it) no longer gets an unfairly
   * inflated-looking average purely because it's missing the old-volume anchor other tags have —
   * every tag's average now comes from a comparably-sized recent sample. `count` below is the
   * actual sample size the average is built from (capped at the window); `totalCount` is the
   * tag's full lifetime solve count, for transparency; `lowSample` flags when `count` itself is
   * still small (see TAG_RATING_LOW_CONFIDENCE_SAMPLE) — solve more, worn thin, whether that
   * thinness is because the tag is barely practiced at all or just barely practiced *recently*.
   */
  topicRatings(problems) {
    const byTag = {};
    for (const p of problems) {
      if (p.rating == null) continue;
      for (const tag of p.tags || []) {
        if (!byTag[tag]) byTag[tag] = [];
        byTag[tag].push(p);
      }
    }
    const out = {};
    for (const [tag, probs] of Object.entries(byTag)) {
      if (probs.length < this.MIN_TOPIC_RATING_SAMPLE) continue;
      const recent = [...probs].sort((a, b) => (a.solvedDate < b.solvedDate ? 1 : -1)).slice(0, this.TAG_RATING_RECENT_WINDOW);
      const ratings = recent.map((p) => p.rating);
      out[tag] = {
        avgRating: this.clusterWeightedAvgRating(ratings),
        count: recent.length,
        totalCount: probs.length,
        min: Math.min(...ratings),
        max: Math.max(...ratings),
        lowSample: recent.length < this.TAG_RATING_LOW_CONFIDENCE_SAMPLE,
        recentProblems: recent,
      };
    }
    return out;
  },

  /**
   * Rating-weighted average: each value's contribution is weighted by its own square, so higher-
   * rated (harder) solves count proportionally more than easier ones instead of every solve
   * counting equally. Used for stats that aren't scoped to one tag (there's no "cluster" concept
   * across unrelated tags) — topicRatings() below uses clusterWeightedAvgRating() instead, which
   * builds on this same weighting. Also used by the Codeforces page's profile-wide "avg. solved
   * rating" stat (js/cf-analysis.js) for the same reason, on the same duplicated-small-helper
   * basis as this file's other cross-page constants.
   */
  weightedAvgRating(ratings) {
    let weightedSum = 0;
    let weightSum = 0;
    for (const r of ratings) {
      const w = r * r;
      weightedSum += r * w;
      weightSum += w;
    }
    return weightSum ? weightedSum / weightSum : null;
  },

  /**
   * Rating-weighted average, ALSO boosted by how many of the sample's OTHER solves share a
   * solve's exact rating — how "clustered" it is. Each solve's density = count of solves in the
   * sample at that same rating (including itself); that density multiplies into the existing
   * rating² weight (see weightedAvgRating above), not in place of it.
   *
   * An earlier version of this smoothed "closeness" continuously (a Gaussian kernel — kernel
   * density estimation, the standard non-parametric-stats technique for measuring how much "mass"
   * of data sits near a point), to avoid a hard bucket boundary splitting two very-close ratings
   * apart. That concern doesn't actually apply here: Codeforces problem ratings only ever land on
   * exact multiples of 100 (800, 900, 1000, ...), never in between, so there's no continuous
   * boundary to smooth over — every possible rating already sits exactly on what would be a
   * bucket's center. Tested against it directly: smoothing only ever diluted the signal (a real
   * 10-of-30 cluster scored LOWER the more the kernel blurred nearby-but-different ratings
   * together), so exact-rating counting — the smoothing's own bandwidth-to-zero limit — is both
   * simpler and measurably better here, not a simplification that costs anything.
   *
   * This is what plain rating-squared weighting can't do on its own: it treats every solve's
   * contribution as a function of its OWN magnitude only, so one lucky high-rated solve among a
   * pile of much easier ones still gets full credit for its own difficulty, undiluted by having
   * no company. Multiplying in density fixes that — a single 2200 sitting alone among mostly 800s
   * now gets weighted like an 800 (density 1, so its r&sup2; weight barely matters against the
   * 800 cluster's r&sup2;&times;N), while a genuine cluster of solves at the same high rating
   * (real, repeated evidence of that level, not a one-off) pulls the average solidly toward it.
   */
  clusterWeightedAvgRating(ratings) {
    const counts = {};
    for (const r of ratings) counts[r] = (counts[r] || 0) + 1;
    let weightedSum = 0;
    let weightSum = 0;
    for (const r of ratings) {
      const w = r * r * counts[r];
      weightedSum += r * w;
      weightSum += w;
    }
    return weightSum ? weightedSum / weightSum : null;
  },

  /** Average topic rating across `tags`, over only the ones this member has enough signal for; null if none. */
  topicRatingAvg(member, tags) {
    const vals = tags.map((t) => member.topicRatings[t]).filter(Boolean).map((s) => s.avgRating);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  },

  /**
   * Tag-occurrence counts over only a member's most recent N solves (READER_RECENT_WINDOW) — see
   * file header for why lifetime counts are the wrong input for a breadth/generalist signal.
   * `p.tags` can include CF's internal "*special" marker tag; filtered out the same way
   * CFBaseline's own tag-ratio helper does, so this stays consistent with tagStats elsewhere.
   */
  recentTagCounts(member, n) {
    const recent = [...member.problems].sort((a, b) => (a.solvedDate < b.solvedDate ? 1 : -1)).slice(0, n);
    const counts = {};
    for (const p of recent) {
      for (const tag of cfBaselineCleanTags(p.tags)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return counts;
  },

  /**
   * Pielou's evenness index (a standard ecology/information-theory diversity measure): 1.0 means
   * solves are spread perfectly evenly across every tag touched (a true generalist — good Reader
   * material), 0 means everything is concentrated in one tag (a narrow specialist). Computed on
   * tag-occurrence counts, not solved-problem counts, since one problem can carry several tags —
   * treating each tag-occurrence as one unit of the distribution is what makes this a valid
   * probability distribution to take entropy over.
   */
  tagEvenness(counts) {
    const values = Object.values(counts).filter((c) => c > 0);
    if (values.length <= 1) return 0;
    const total = values.reduce((s, c) => s + c, 0);
    let entropy = 0;
    for (const c of values) {
      const p = c / total;
      entropy -= p * Math.log2(p);
    }
    return entropy / Math.log2(values.length); // normalized to 0..1 (Pielou's J)
  },

  /**
   * How far above their own current rating a member typically reaches at their best — the
   * average rating of their top REACH_TOP_N hardest solves, minus their current rating. Uses the
   * top solves rather than a straight average across their whole history deliberately: someone
   * with thousands of solved problems has necessarily solved a huge tail of easy ones while
   * leveling up over the years, which would swamp a plain average and make it a poor Thinker
   * signal for experienced players. The "ceiling" (best few reaches) is a much more direct
   * measure of insight/ambition, and is the same reasoning Codeforces' own problem-rating
   * methodology uses to define difficulty relative to a solver's rating (see README sources).
   */
  computeReach(member) {
    if (member.currentRating == null) return null;
    const rated = member.problems.map((p) => p.rating).filter((r) => r != null).sort((a, b) => b - a);
    if (rated.length < this.REACH_MIN_SAMPLE) return null;
    const top = rated.slice(0, this.REACH_TOP_N);
    const avgTop = top.reduce((s, r) => s + r, 0) / top.length;
    return avgTop - member.currentRating;
  },

  topTags(member, n) {
    return Object.entries(member.tagStats.ratios)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([tag, ratio]) => ({ tag, ratio }));
  },

  /** Tags where even the strongest team member barely solves any — a knowledge gap, not just bad luck. */
  computeKnowledgeGaps(members) {
    return this.CORE_TAGS.map((tag) => ({ tag, maxRatio: Math.max(...members.map((m) => m.tagStats.ratios[tag] || 0)) }))
      .filter((r) => r.maxRatio < this.KNOWLEDGE_GAP_RATIO_CUTOFF)
      .sort((a, b) => a.maxRatio - b.maxRatio)
      .slice(0, this.TEAM_GAP_MAX_SHOWN);
  },

  /**
   * Tags the team attempts plenty of but still gets wrong a lot — a different failure mode than
   * a knowledge gap (this is "we know the theory, we keep messing up the execution"), matching
   * the classic post-contest-review distinction between a knowledge gap and an implementation
   * mistake (see README sources). Aggregates counts/wrong-attempts across all 3 members' own
   * per-tag accuracy (not an average of percentages, which would misweight small samples) before
   * computing one team-wide accuracy per tag.
   */
  computeExecutionGaps(members) {
    const tagAgg = {};
    for (const m of members) {
      for (const [tag, s] of Object.entries(m.accuracyByTag)) {
        if (!this.CORE_TAGS.includes(tag)) continue;
        const agg = tagAgg[tag] || { count: 0, totalWrong: 0 };
        agg.count += s.count;
        agg.totalWrong += s.totalWrong;
        tagAgg[tag] = agg;
      }
    }
    return Object.entries(tagAgg)
      .map(([tag, agg]) => ({ tag, count: agg.count, accuracyPct: (agg.count / (agg.count + agg.totalWrong)) * 100 }))
      .filter((r) => r.count >= this.EXECUTION_GAP_MIN_COUNT && r.accuracyPct < this.EXECUTION_GAP_ACCURACY_CUTOFF)
      .sort((a, b) => a.accuracyPct - b.accuracyPct)
      .slice(0, this.TEAM_GAP_MAX_SHOWN);
  },

  /**
   * A member's specific weak spot within "implementation-ish" tags, when it's notably worse
   * than their own overall accuracy — a targeted, evidence-based version of "you have a slow/
   * buggy implementation" rather than a vague claim.
   */
  implementationCallout(member) {
    const overall = member.overallAccuracy;
    if (!overall) return null;
    let worst = null;
    for (const tag of this.IMPLEMENTATION_WATCH_TAGS) {
      const s = member.accuracyByTag[tag];
      if (!s) continue;
      const gap = overall.accuracyPct - s.accuracyPct;
      if (gap >= this.IMPLEMENTATION_GAP_PTS && (!worst || gap > worst.gap)) worst = { tag, pct: s.accuracyPct, gap };
    }
    if (!worst) return null;
    return `Especially bug-prone on "${worst.tag}" problems (${worst.pct.toFixed(0)}% vs ${overall.accuracyPct.toFixed(0)}% overall accuracy) — worth extra care there.`;
  },

  /**
   * Reader/Coder/Thinker scores, each built from signals that actually match that role's real
   * job (see file header for sourcing) rather than one generic formula for all three:
   *  - Reader: breadth, not raw skill — Pielou's evenness (see tagEvenness) blended with distinct
   *    tag count, both computed over each member's RECENT solves only (see recentTagCounts and
   *    the file header for why). A Reader's job is recognizing ANY problem type fast, so a broad
   *    recent generalist beats a narrow specialist here regardless of rating or career length.
   *  - Coder: per-topic RATING (see topicRatingAvg) in "standard technique" tags, blended with
   *    overall accuracy and live-contest solve speed — the three things that define fast, clean,
   *    standard-problem execution.
   *  - Thinker: per-topic RATING in "insight-heavy" tags, blended with current rating and "reach"
   *    (computeReach) — the two direct measures of raw problem-solving power research ties to
   *    this role, on top of a topic-specific difficulty ceiling.
   * Every component is null-safe end to end: normalizeValues degrades gracefully whenever a
   * member lacks a given signal (no live-contest submissions, no rated solves in a tag bucket,
   * etc.), falling back to whatever data they do have instead of unfairly zeroing them out.
   */
  scoreRoles(members) {
    const recentCounts = members.map((m) => this.recentTagCounts(m, this.READER_RECENT_WINDOW));
    const evenness = recentCounts.map((c) => this.tagEvenness(c));
    const breadthCount = recentCounts.map((c) => Object.keys(c).length);
    const nEven = normalizeValues(evenness);
    const nBreadth = normalizeValues(breadthCount);
    const readerScore = members.map((_, i) => 0.5 * nEven[i] + 0.5 * nBreadth[i]);

    const coderTagRaw = members.map((m) => this.topicRatingAvg(m, this.CODER_TAGS));
    const accRaw = members.map((m) => (m.overallAccuracy ? m.overallAccuracy.accuracyPct / 100 : null));
    const speedRaw = members.map((m) => (m.speed.insufficientData ? null : -m.speed.medianMinutes));
    const nCoderTag = normalizeValues(coderTagRaw);
    const nAcc = normalizeValues(accRaw);
    const nSpeed = normalizeValues(speedRaw);
    const coderScore = members.map((_, i) => {
      const parts = [];
      if (coderTagRaw[i] != null) parts.push(nCoderTag[i]);
      if (accRaw[i] != null) parts.push(nAcc[i]);
      if (speedRaw[i] != null) parts.push(nSpeed[i]);
      return parts.length ? parts.reduce((s, v) => s + v, 0) / parts.length : 0.5;
    });

    const thinkerTagRaw = members.map((m) => this.topicRatingAvg(m, this.THINKER_TAGS));
    const ratingRaw = members.map((m) => m.currentRating);
    const reachRaw = members.map((m) => this.computeReach(m));
    const nThinkerTag = normalizeValues(thinkerTagRaw);
    const nRating = normalizeValues(ratingRaw);
    const nReach = normalizeValues(reachRaw);
    const thinkerScore = members.map((_, i) => {
      const parts = [];
      if (thinkerTagRaw[i] != null) parts.push(nThinkerTag[i]);
      if (ratingRaw[i] != null) parts.push(nRating[i]);
      if (reachRaw[i] != null) parts.push(nReach[i]);
      return parts.length ? parts.reduce((s, v) => s + v, 0) / parts.length : 0.5;
    });

    return members.map((_, i) => [readerScore[i], coderScore[i], thinkerScore[i]]);
  },

  /** Raw (non-normalized) per-topic rating per domain — [domainIdx][memberIdx], null where a member lacks enough data. */
  rawDomainRatings(members) {
    return this.DOMAINS.map((d) => members.map((m) => this.topicRatingAvg(m, d.tags)));
  },

  /** Domain ownership from per-topic RATING (not solve-count ratio) — "whose problem is this, strength-wise." */
  scoreDomains(members) {
    const raw = this.rawDomainRatings(members);
    const byDomain = raw.map((col) => normalizeValues(col));
    return members.map((_, mi) => byDomain.map((col) => col[mi]));
  },

  /**
   * Best member-to-slot assignment by brute-force search over all 6 permutations of 3 slots —
   * NOT a greedy "assign the single highest score first" loop, which is provably non-optimal
   * even at 3x3 (locking in the best individual cell can foreclose a much better global
   * pairing — this is the classic assignment problem, generally solved by the Hungarian
   * algorithm; at n=3, exhaustive search over 3!=6 permutations is simpler and equally optimal).
   * Used for both the Reader/Coder/Thinker role assignment and the domain-ownership assignment.
   */
  bestAssignment(matrix) {
    let best = null;
    for (const perm of this.ASSIGNMENT_PERMS) {
      const total = perm.reduce((s, slotIdx, memberIdx) => s + matrix[memberIdx][slotIdx], 0);
      if (!best || total > best.total) best = { perm, total };
    }
    return best.perm;
  },

  /** Fastest/middle/slowest labels, relative to THIS team only — no universal absolute cutoff. */
  rankSpeeds(members) {
    const withSpeed = members.map((m, i) => ({ i, minutes: m.speed.insufficientData ? null : m.speed.medianMinutes }));
    const usable = withSpeed.filter((x) => x.minutes != null).sort((a, b) => a.minutes - b.minutes);
    const labels = new Array(members.length).fill(null);
    if (usable.length >= 2) {
      usable.forEach((x, rank) => {
        labels[x.i] = rank === 0 ? "Fastest on the team" : rank === usable.length - 1 ? "Slowest on the team" : "Middle of the team";
      });
    }
    return labels;
  },

  accuracyLabel(pct) {
    if (pct >= 85) return "Very clean";
    if (pct >= 70) return "Solid";
    if (pct >= 50) return "Debug-heavy";
    return "Very debug-heavy";
  },

  /** Deterministic, data-grounded summary — not free-form generation, see file header. */
  buildSummaryParagraph(member, roleLabel, domainLabel, domainRating, speedRankLabel) {
    const rank = this.rankTitle(member.currentRating);
    const ratingPart =
      member.currentRating != null ? `has Codeforces Rating ${member.currentRating}${rank ? ` (${rank})` : ""}` : "is unrated";
    const topTags = this.topTags(member, 2);
    const topTagsPart = topTags.length ? ` Strongest in ${topTags.map((t) => t.tag).join(" and ")}.` : "";
    const acc = member.overallAccuracy;
    const accPart = acc ? ` ${this.accuracyLabel(acc.accuracyPct)} accuracy (${acc.accuracyPct.toFixed(0)}%).` : " Not enough solves yet to measure accuracy.";
    const speedPart = speedRankLabel ? ` ${speedRankLabel}.` : member.speed.insufficientData ? " Not enough live-contest data to rank solving speed." : "";
    const domainPart = domainRating != null ? `${domainLabel} (Topic Wise Rating ~${Math.round(domainRating)})` : domainLabel;
    return `${member.handle} ${ratingPart}, ${member.totalSolved} solved.${topTagsPart}${accPart}${speedPart} Suggested role: ${roleLabel} (owns ${domainPart}).`;
  },

  /**
   * Validates and fetches all 3 handles ONE AT A TIME (with a short stagger between each), not
   * via Promise.all — firing all 3 handles' requests simultaneously (6 total: 2 endpoints x 3
   * handles) reliably triggered Codeforces' rate limiting, either failing the whole analysis or
   * silently dropping a single handle's rating fetch (see fetchWithRetry's doc comment). This is
   * slower (each handle now waits for the previous one) but far more reliable — combined with
   * fetchWithRetry, a single transient hiccup no longer surfaces as a bug.
   *
   * Returns { ok:true, members } on full success, or { ok:false, error } (a pre-fetch validation
   * problem, no fetch attempted) / { ok:false, error, members } (one or more handles failed even
   * after retries — error lists which ones) otherwise. On success, caches members for render().
   * `onProgress(message)`, if given, is called before each handle starts fetching.
   */
  async analyze(handles, { onProgress } = {}) {
    const trimmed = handles.map((h) => (h || "").trim());
    if (trimmed.some((h) => !h)) return { ok: false, error: "Enter all three Codeforces handles." };
    const lower = trimmed.map((h) => h.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      return { ok: false, error: "Enter three different handles — you can't compare a handle with itself." };
    }
    const members = [];
    for (let i = 0; i < trimmed.length; i++) {
      if (onProgress) onProgress(`Fetching ${trimmed[i]}… (${i + 1}/${trimmed.length})`);
      members.push(await this.fetchMemberData(trimmed[i]));
      if (i < trimmed.length - 1) await this.sleep(this.HANDLE_STAGGER_MS);
    }
    const failed = members.filter((m) => !m.ok);
    if (failed.length) {
      return { ok: false, error: failed.map((m) => `${m.handle}: ${m.error}`).join(" · "), members };
    }
    this._members = members;
    return { ok: true, members };
  },

  render(root) {
    if (!root) return;
    const members = this._members;
    if (!members) {
      root.innerHTML = "";
      return;
    }
    const roleMatrix = this.scoreRoles(members);
    const roleAssignment = this.bestAssignment(roleMatrix);
    const domainMatrix = this.scoreDomains(members);
    const domainAssignment = this.bestAssignment(domainMatrix);
    const rawDomainRatings = this.rawDomainRatings(members);
    const speedLabels = this.rankSpeeds(members);
    const knowledgeGaps = this.computeKnowledgeGaps(members);
    const executionGaps = this.computeExecutionGaps(members);
    const teamStats = this.computeTeamStats(members);
    const totalUnique = new Set(members.flatMap((m) => m.problems.map((p) => p.key))).size;

    const statTile = (value, label) => `<div class="stat-tile"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
    const teamStatsHtml = [
      statTile(teamStats.avgRating ?? "—", "avg. team Codeforces Rating"),
      statTile(teamStats.ratingSpread != null ? teamStats.ratingSpread : "—", "Codeforces Rating spread"),
      statTile(teamStats.combinedAccuracy != null ? teamStats.combinedAccuracy.toFixed(0) + "%" : "—", "combined accuracy"),
      statTile(`${teamStats.tagsCovered}/${teamStats.totalCoreTags}`, "core tags covered"),
    ].join("");

    const rolesTableHtml = members
      .map((m, i) => {
        const role = this.ROLES[roleAssignment[i]];
        return `<div class="stat-tile" title="${escapeHtml(role.blurb)}"><div class="stat-value">${escapeHtml(role.label)}</div><div class="stat-label">${escapeHtml(m.handle)}</div></div>`;
      })
      .join("");
    const domainsTableHtml = members
      .map((m, i) => {
        const domainIdx = domainAssignment[i];
        const rating = rawDomainRatings[domainIdx][i];
        const ratingLabel = rating != null ? `Topic Wise Rating: ~${Math.round(rating)}` : "not enough data yet";
        return `<div class="stat-tile" title="${escapeHtml(ratingLabel)}"><div class="stat-value">${escapeHtml(this.DOMAINS[domainIdx].label)}</div><div class="stat-label">${escapeHtml(m.handle)} &middot; ${escapeHtml(ratingLabel)}</div></div>`;
      })
      .join("");

    const knowledgeGapsHtml = knowledgeGaps.length
      ? `<p class="card-subtitle"><strong>Knowledge gaps</strong> &mdash; nobody on the team solves much of: ${knowledgeGaps.map((g) => `${escapeHtml(g.tag)} (best: ${Math.round(g.maxRatio * 100)}%)`).join(", ")}. Worth learning together.</p>`
      : `<p class="card-subtitle"><strong>Knowledge gaps</strong> &mdash; none found among common ICPC topics; solid shared coverage.</p>`;
    const executionGapsHtml = executionGaps.length
      ? `<p class="card-subtitle"><strong>Execution gaps</strong> &mdash; the team attempts these plenty but still gets them wrong a lot: ${executionGaps.map((g) => `${escapeHtml(g.tag)} (${g.accuracyPct.toFixed(0)}% on ${g.count} attempts)`).join(", ")}. Not a knowledge problem &mdash; worth extra care on the write-and-debug side.</p>`
      : `<p class="card-subtitle"><strong>Execution gaps</strong> &mdash; none found; accuracy holds up on the tags the team attempts often.</p>`;

    root.innerHTML = `
      <section class="card">
        <h2>Team insights</h2>
        <p class="card-subtitle">
          Suggested roles based on solve history &mdash; a starting point, not a verdict.
          ${members.length} handles compared, ${totalUnique} unique problems solved across the team.
        </p>
        <div class="report-windows">${teamStatsHtml}</div>
        <h3 class="card-section-label">Role (who does what during the contest)</h3>
        <div class="report-windows">${rolesTableHtml}</div>
        <h3 class="card-section-label">Domain (whose problem is it when it's clearly one topic)</h3>
        <div class="report-windows">${domainsTableHtml}</div>
        ${knowledgeGapsHtml}
        ${executionGapsHtml}
      </section>
      <div class="card-grid">
        ${members
          .map((m, i) => {
            const domainIdx = domainAssignment[i];
            return this.memberCardHtml(m, this.ROLES[roleAssignment[i]].label, this.DOMAINS[domainIdx].label, rawDomainRatings[domainIdx][i], speedLabels[i]);
          })
          .join("")}
      </div>
      <section class="card">
        <h2>Tag breakdown</h2>
        <p class="card-subtitle">
          One compact row per tag &mdash; each bar spans that person's lowest-to-highest solved
          problem rating in their last ${this.TAG_RATING_RECENT_WINDOW} solves in that tag (marker
          = their Topic Wise Rating, a weighted average), and the number alongside is that Topic
          Wise Rating, how many of their solves in that tag went into it, and their share of
          solves overall. Topic Wise Ratings are weighted toward harder solves, limited to those
          recent ${this.TAG_RATING_RECENT_WINDOW} (an old pile of easy solves can't drag the
          number down, and a barely-touched tag isn't unfairly inflated just for missing that old
          volume), AND boosted by clustering &mdash; a solve that's part of a real group of
          similarly-rated solves counts for more than an equally-hard one-off, so one lucky high
          solve can't single-handedly pull the number up, but a genuine run of solves at a similar
          high difficulty will. <strong>&#9888;</strong> next to a number means that tag's sample
          is thin (under ${this.TAG_RATING_LOW_CONFIDENCE_SAMPLE} solves going into the average)
          &mdash; solve more of it for a steadier number.
          <strong>Hover any point on a bar</strong> to see exactly how many problems at that
          rating, in that tag, they solved.
        </p>
        <div id="team-tag-breakdown-root"></div>
      </section>
    `;
    this.renderTagBreakdown($("team-tag-breakdown-root"), members);
  },

  /** Bar-width position of `rating` on the fixed TAG_RATING_MIN..TAG_RATING_MAX scale, clamped 0..100. */
  ratingBarPct(rating) {
    const pct = ((rating - this.TAG_RATING_MIN) / (this.TAG_RATING_MAX - this.TAG_RATING_MIN)) * 100;
    return Math.max(0, Math.min(100, pct));
  },

  /**
   * How many of `problems` fall in each 100-wide rating bucket — same bucketing convention as the
   * Codeforces page's "Problem ratings" histogram (js/cf-analysis.js). Takes the already tag-
   * filtered, recency-windowed list from topicRatings()'s `recentProblems` (not a member's full
   * history) so the bar's shape always matches what the average/marker was actually computed
   * from — showing the full lifetime distribution here while the marker reflects only the recent
   * window would make the two visually disagree.
   */
  tagRatingBuckets(problems) {
    const counts = {};
    for (const p of problems) {
      if (p.rating == null) continue;
      const bucket = Math.floor(p.rating / 100) * 100;
      counts[bucket] = (counts[bucket] || 0) + 1;
    }
    return counts;
  },

  /**
   * Single shared floating tooltip element (created once, reused for every hover across the
   * whole chart) rather than a native `title` per segment. Native title tooltips turned out
   * unusable here: segments can be just a few pixels wide, an ancestor needs `overflow:hidden`
   * to keep the fills clipped to the track's rounded shape (which also clips any tooltip
   * attached to a descendant), and OS tooltip delay/placement is inconsistent across browsers.
   * A real mousemove-driven tooltip fixes all three: it reads the cursor's continuous position
   * across the *entire* track (no tiny hit-targets to land on), lives outside any clipping
   * ancestor, and appears instantly next to the cursor.
   */
  ensureTooltipEl() {
    let el = document.getElementById("team-rating-tooltip");
    if (!el) {
      el = document.createElement("div");
      el.id = "team-rating-tooltip";
      el.className = "floating-tooltip";
      el.hidden = true;
      document.body.appendChild(el);
    }
    return el;
  },

  showTooltip(clientX, clientY, text) {
    const el = this.ensureTooltipEl();
    el.textContent = text;
    el.hidden = false;
    // Clamp so the tooltip never runs off the right/bottom edge of the viewport.
    const left = Math.min(clientX + 14, window.innerWidth - el.offsetWidth - 8);
    const top = Math.min(clientY + 14, window.innerHeight - el.offsetHeight - 8);
    el.style.left = `${Math.max(4, left)}px`;
    el.style.top = `${Math.max(4, top)}px`;
  },

  hideTooltip() {
    const el = document.getElementById("team-rating-tooltip");
    if (el) el.hidden = true;
  },

  /**
   * Delegated mousemove/mouseleave on the whole chart root (called once per render) — computes
   * the hovered rating from the cursor's X position relative to whichever `.rating-range-track`
   * it's over, looks up that bucket's count from the track's `data-buckets`, and shows it. Works
   * anywhere along the bar, not just on a specific segment.
   */
  wireRatingTooltips(root) {
    if (root._ratingTooltipWired) return;
    root._ratingTooltipWired = true;
    root.addEventListener("mousemove", (evt) => {
      const track = evt.target.closest(".rating-range-track");
      if (!track || !track.dataset.buckets) {
        this.hideTooltip();
        return;
      }
      const rect = track.getBoundingClientRect();
      const relX = rect.width ? Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width)) : 0;
      const rating = this.TAG_RATING_MIN + relX * (this.TAG_RATING_MAX - this.TAG_RATING_MIN);
      const bucket = Math.floor(rating / 100) * 100;
      const buckets = JSON.parse(track.dataset.buckets);
      const count = buckets[bucket] || 0;
      const text = `${track.dataset.handle} — ${track.dataset.tag} rated ${bucket}–${bucket + 99}: ${count} solved`;
      this.showTooltip(evt.clientX, evt.clientY, text);
    });
    root.addEventListener("mouseleave", () => this.hideTooltip());
  },

  /**
   * One member's compact cell in the merged tag-breakdown row: a small range bar (lowest-to-
   * highest solved rating in this tag, built from 100-wide segments shaded by how many solves
   * fall in each — see tagRatingBuckets) plus their rating and solve-share in one line. The bar
   * itself carries no per-segment titles (see wireRatingTooltips for why); `data-*` attributes
   * hold what the shared tooltip needs to answer "how many problems at this rating did they
   * solve," continuously along the whole bar, not just on whichever thin segment you land on.
   */
  tagMemberCellHtml(member, tag, color, ratingStats, sharePct, rawCount) {
    if (!ratingStats) {
      const countLabel = rawCount > 0 ? `${rawCount} solved &middot; ` : "";
      return `
        <div class="tag-member-cell">
          <span class="tag-member-dot" style="background:${color}"></span>
          <div class="rating-range-track"><div class="rating-range-segments"></div></div>
          <span class="tag-member-stats">${countLabel}${sharePct}%</span>
        </div>`;
    }
    const buckets = this.tagRatingBuckets(ratingStats.recentProblems);
    const bucketKeys = Object.keys(buckets).map(Number);
    const maxBucketCount = Math.max(1, ...bucketKeys.map((b) => buckets[b]));
    const segments = bucketKeys
      .sort((a, b) => a - b)
      .map((b) => {
        const left = this.ratingBarPct(b);
        const width = Math.max(0.5, this.ratingBarPct(b + 100) - left);
        const opacity = (0.3 + 0.7 * (buckets[b] / maxBucketCount)).toFixed(2);
        return `<div class="rating-range-segment" style="left:${left}%;width:${width}%;background:${color};opacity:${opacity}"></div>`;
      })
      .join("");
    const avgPct = this.ratingBarPct(ratingStats.avgRating);
    const sampleFlag = ratingStats.lowSample
      ? ` <span class="low-sample-flag" title="Only ${ratingStats.count} solve${ratingStats.count === 1 ? "" : "s"} in this tag so far &mdash; solve more for a steadier number.">&#9888;</span>`
      : "";
    return `
      <div class="tag-member-cell">
        <span class="tag-member-dot" style="background:${color}"></span>
        <div class="rating-range-track" data-handle="${escapeHtml(member.handle)}" data-tag="${escapeHtml(tag)}" data-buckets='${JSON.stringify(buckets)}'>
          <div class="rating-range-segments">${segments}</div>
          <div class="rating-range-marker" style="left:${avgPct}%;background:${color}"></div>
        </div>
        <span class="tag-member-stats">~${Math.round(ratingStats.avgRating)} (${ratingStats.count}) &middot; ${sharePct}%${sampleFlag}</span>
      </div>`;
  },

  /**
   * Merged tag-rating + tag-mix chart, one compact row per CORE_TAG instead of the old design's
   * separate multi-line-per-person sections for each — both showed the same 20-25 tags, just
   * twice, taking up a lot of vertical space for what's really one comparison. Each row now
   * shows all 3 members side by side (rating range + solve share together), sorted by the team's
   * best average rating in that tag. No commentary, just the numbers.
   */
  renderTagBreakdown(root, members) {
    if (!root) return;
    const colors = ["var(--accent)", "var(--secondary)", "var(--warn)"];
    const tags = this.CORE_TAGS.filter((tag) => members.some((m) => m.topicRatings[tag] || (m.tagStats.counts[tag] || 0) > 0));

    if (!tags.length) {
      root.innerHTML = `<p class="empty-note">Not enough solves yet to show a tag breakdown.</p>`;
      return;
    }
    tags.sort((a, b) => {
      const bestOf = (tag) => Math.max(...members.map((m) => (m.topicRatings[tag] ? m.topicRatings[tag].avgRating : 0)));
      return bestOf(b) - bestOf(a);
    });

    root.innerHTML = `
      <div class="cf-legend">
        ${members.map((m, i) => `<span><span class="cf-legend-swatch" style="background:${colors[i]}"></span>${escapeHtml(m.handle)}</span>`).join("")}
      </div>
      <div class="tag-breakdown-list">
        ${tags
          .map((tag) => {
            const cells = members
              .map((m, i) => {
                const pct = Math.round((m.tagStats.ratios[tag] || 0) * 100);
                return this.tagMemberCellHtml(m, tag, colors[i], m.topicRatings[tag] || null, pct, m.tagStats.counts[tag] || 0);
              })
              .join("");
            return `<div class="tag-row"><div class="tag-row-label">${escapeHtml(tag)}</div><div class="tag-row-members">${cells}</div></div>`;
          })
          .join("")}
      </div>
    `;
    this.wireRatingTooltips(root);
  },

  memberCardHtml(member, roleLabel, domainLabel, domainRating, speedRankLabel) {
    const rank = this.rankTitle(member.currentRating);
    const acc = member.overallAccuracy;
    const accPct = acc ? acc.accuracyPct.toFixed(0) : null;
    const speedValue = speedRankLabel
      ? speedRankLabel.replace(" on the team", "").replace(" of the team", "")
      : member.speed.insufficientData
        ? "N/A"
        : `${Math.round(member.speed.medianMinutes)}m`;
    const implCallout = this.implementationCallout(member);
    const summary = this.buildSummaryParagraph(member, roleLabel, domainLabel, domainRating, speedRankLabel);
    const topTags = this.topTags(member, 4);
    const domainTitle = domainRating != null ? `Topic Wise Rating: ~${Math.round(domainRating)} in this domain` : "not enough solves here to rate yet";

    return `
      <div class="card">
        <h3>${escapeHtml(member.handle)} <span class="role-badge">${escapeHtml(roleLabel)}</span><span class="role-badge domain-badge" title="${escapeHtml(domainTitle)}">${escapeHtml(domainLabel)}</span></h3>
        <p class="card-subtitle">${escapeHtml(summary)}</p>
        <div class="report-windows">
          <div class="stat-tile"><div class="stat-value">${member.currentRating ?? "—"}</div><div class="stat-label">${escapeHtml(rank ? `Codeforces Rating (${rank})` : "Codeforces Rating")}</div></div>
          <div class="stat-tile"><div class="stat-value">${member.totalSolved}</div><div class="stat-label">total solved</div></div>
          <div class="stat-tile"><div class="stat-value">${accPct != null ? accPct + "%" : "—"}</div><div class="stat-label">accuracy</div></div>
          <div class="stat-tile"><div class="stat-value">${escapeHtml(speedValue)}</div><div class="stat-label">solve speed (team rank)</div></div>
        </div>
        ${implCallout ? `<p class="card-subtitle">${escapeHtml(implCallout)}</p>` : ""}
        <p class="card-subtitle">Strongest tags: ${topTags.length ? topTags.map((t) => escapeHtml(t.tag)).join(", ") : "—"}</p>
      </div>
    `;
  },

};
