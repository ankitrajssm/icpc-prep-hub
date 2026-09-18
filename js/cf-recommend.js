/**
 * "Next problem" recommendations: unsolved problems in the user's weak tags,
 * just above a target rating blended from their current CF rating AND the
 * typical rating of problems they've actually been solving recently (the
 * two can diverge — a rusty high-rated account, or someone actively
 * upskilling past their old rating). Needs the live problemset, so it's a
 * user-triggered fetch rather than baked into the static baseline data.
 */
const CFRecommend = {
  problemsetUrl() {
    return "https://codeforces.com/api/problemset.problems";
  },

  /** Blend of current CF rating and the average rating of your last 20 rated solves. */
  computeTargetRating() {
    const { ratingHistory } = Store.data.cf;
    const currentRating = ratingHistory.length ? ratingHistory[ratingHistory.length - 1].newRating : null;

    const recentRated = Store.data.solvedLog
      .filter((p) => p.rating)
      .slice()
      .sort((a, b) => (a.solvedDate < b.solvedDate ? 1 : -1))
      .slice(0, 20);
    const comfortRating = recentRated.length ? Math.round(recentRated.reduce((sum, p) => sum + p.rating, 0) / recentRated.length) : null;

    if (currentRating && comfortRating) return Math.round((currentRating + comfortRating) / 2);
    return currentRating || comfortRating || 1200;
  },

  /** Live-fetch the full problemset and filter to unsolved, in-band, weak-tagged problems. */
  async fetchRecommendations({ weakTags, targetRating, count = 10 }) {
    try {
      const res = await fetch(this.problemsetUrl());
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = await res.json();
      if (json.status !== "OK") return { ok: false, error: json.comment || "Codeforces API returned an error" };

      const solvedKeys = new Set(Store.data.solvedLog.map((p) => p.key));
      const low = targetRating;
      const high = targetRating + 300;
      const weakSet = new Set(weakTags);

      const candidates = json.result.problems.filter((p) => {
        if (!p.rating || p.rating < low || p.rating > high) return false;
        if (solvedKeys.has(Gamification.problemKey(p.contestId, p.index))) return false;
        return (p.tags || []).some((t) => weakSet.has(t));
      });
      candidates.sort((a, b) => a.rating - b.rating);

      return { ok: true, problems: candidates.slice(0, count), targetRating, low, high };
    } catch (e) {
      return { ok: false, error: e.message || "Network/CORS error" };
    }
  },
};
