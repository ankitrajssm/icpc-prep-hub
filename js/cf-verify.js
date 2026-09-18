/**
 * Codeforces handle ownership verification, for linking a handle to a cloud
 * account. Codeforces has no OAuth, so we use the standard trick: ask the
 * user to submit a solution that fails to compile to a specific (old,
 * stable) problem within a time window, then check the submission history
 * for that exact compile-error submission.
 */
const CFVerify = {
  PROBLEM_POOL: [
    { contestId: 4, index: "A", name: "Watermelon" },
    { contestId: 1, index: "A", name: "Theatre Square" },
    { contestId: 71, index: "A", name: "Way Too Long Words" },
    { contestId: 158, index: "A", name: "Next Round" },
  ],

  GRACE_MS: 2 * 60 * 1000,
  WINDOW_MINUTES: 10,

  pickProblem() {
    return this.PROBLEM_POOL[Math.floor(Math.random() * this.PROBLEM_POOL.length)];
  },

  /**
   * Links straight to the contest-scoped submit form (`/contest/{id}/submit/{index}`), not the
   * problem statement page (`/problemset/problem/{id}/{index}`). The statement page's own
   * "Submit Code" link dumps you on `/problemset/submit`, a contest-agnostic form where the
   * problem field is a free-text search box you have to type/search into — annoying when all you
   * need is to submit one throwaway broken line. The contest-scoped submit URL instead pre-selects
   * this exact problem in a simple dropdown (just that contest's problems, e.g. A/B/C/D).
   */
  problemUrl(problem) {
    return `https://codeforces.com/contest/${problem.contestId}/submit/${problem.index}`;
  },

  /**
   * `handle` is actually checked here (against each submission's `author.members`), not just
   * accepted for show — this matters most for checkManual below, where the "submissions" are
   * arbitrary pasted text with no other guarantee they came from Codeforces at all or belong to
   * the handle being verified. Also enforces the advertised WINDOW_MINUTES as a real upper bound
   * (previously only shown as UI copy, never checked), so a verification session doesn't stay
   * matchable indefinitely.
   */
  matchInSubmissions(submissions, handle, problem, startedAtMs) {
    const targetHandle = (handle || "").trim().toLowerCase();
    const deadlineMs = startedAtMs + this.WINDOW_MINUTES * 60 * 1000 + this.GRACE_MS;
    return submissions.some((sub) => {
      if (!sub.problem || sub.problem.contestId !== problem.contestId || sub.problem.index !== problem.index) return false;
      if (sub.verdict !== "COMPILATION_ERROR") return false;
      const subMs = sub.creationTimeSeconds * 1000;
      if (subMs < startedAtMs - this.GRACE_MS || subMs > deadlineMs) return false;
      if (targetHandle) {
        const members = (sub.author && sub.author.members) || [];
        if (!members.some((m) => (m.handle || "").toLowerCase() === targetHandle)) return false;
      }
      return true;
    });
  },

  /** Live check. Resolves { ok: true, verified: boolean } or { ok: false, error }. */
  async checkLive(handle, problem, startedAtMs) {
    try {
      const res = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=30`);
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = await res.json();
      if (json.status !== "OK") return { ok: false, error: json.comment || "Codeforces API returned an error" };
      return { ok: true, verified: this.matchInSubmissions(json.result, handle, problem, startedAtMs) };
    } catch (e) {
      return { ok: false, error: e.message || "Network/CORS error" };
    }
  },

  /**
   * Manual fallback: parse pasted JSON the same shape as user.status. `handle` is required and
   * checked against each submission's author — pasted text has no other authenticity guarantee,
   * so this is the one thing standing between "proves you own this handle" and "proves you can
   * type JSON." It's still ultimately client-supplied text a determined user could hand-fabricate
   * (there's no server here to fetch it independently), but this closes the trivial version of
   * that gap where the pasted blob doesn't even need to mention the claimed handle.
   */
  checkManual(jsonText, handle, problem, startedAtMs) {
    const parsed = JSON.parse(jsonText);
    const submissions = Array.isArray(parsed) ? parsed : parsed.result;
    if (!Array.isArray(submissions)) throw new Error("Couldn't find a submissions array in that JSON.");
    return this.matchInSubmissions(submissions, handle, problem, startedAtMs);
  },
};
