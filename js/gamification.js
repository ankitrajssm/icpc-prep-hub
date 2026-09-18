/**
 * Points formula and reward/log bookkeeping.
 *
 * base = round(rating / 100) - 5 for rated problems (3 for the lowest CF rating, 800; 4 for
 * 900; and so on), flat 5 for unrated. x1.5 (rounded) if any of the problem's tags is in the
 * user's focus-tags list. Floored at 1 — real Codeforces ratings never go below 800 (base 3),
 * but the manual "log a solve" form only enforces min=0 on its rating field, so a low typed-in
 * value must not be able to swing base negative and drain the balance. Problems solved before
 * the gamification start date always score 0 (logged for stats only).
 *
 * Solves ALWAYS score 0 unless the configured handle has passed CF verification (see
 * cf-verify.js) — syncing itself is also locked behind verification (js/pages/codeforces.js
 * applyLockState), so this guard is now belt-and-suspenders rather than the only thing standing
 * between an unproven handle and a real point balance.
 */
function computePoints({ rating, tags, solvedDate }, { focusTags, gamificationStart, cfVerified }) {
  if (!cfVerified) return 0;
  if (gamificationStart && solvedDate < gamificationStart) {
    return 0;
  }
  const base = rating ? Math.max(1, Math.round(rating / 100) - 5) : 5;
  const isFocus = Array.isArray(tags) && tags.some((t) => focusTags.includes(t));
  return isFocus ? Math.round(base * 1.5) : base;
}

function problemKey(contestId, index) {
  return `${contestId}${index}`;
}

// The first points-earning solve of a calendar day gets a streak bonus (flat points, capped),
// scaled by how many consecutive prior days already have a points-earning solve. A solve before
// the gamification start date scores 0 base points and so never counts as a "day" for the streak —
// the streak inherently starts from that date, with no separate cutoff needed.
const STREAK_BONUS_CAP = 15;

function dayStr(dateLike) {
  return new Date(dateLike).toDateString();
}

/** Set of calendar-day strings that have at least one points-earning (points > 0) solve. */
function pointsEarningDays(solvedLog) {
  const days = new Set();
  for (const s of solvedLog) {
    if (s.points > 0) days.add(dayStr(s.solvedDate));
  }
  return days;
}

/**
 * Current streak of consecutive points-earning days. If today already has a solve, today counts
 * and the streak extends backward from today; otherwise it reports the still-alive streak ending
 * yesterday (0 if that's also broken), so the caller can prompt "solve today to keep it going".
 */
function computeStreak(solvedLog) {
  const days = pointsEarningDays(solvedLog);
  const today = new Date();
  const solvedToday = days.has(dayStr(today));
  const cursor = new Date(today);
  if (!solvedToday) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(dayStr(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { count, solvedToday };
}

// The 3 starter rewards ship as `locked: true`, but a profile saved before that field
// existed won't have it on disk — match by id too so already-installed users are covered.
const LOCKED_REWARD_IDS = ["r-youtube", "r-treat", "r-afternoon"];
function isLockedReward(reward) {
  return Boolean(reward) && (reward.locked === true || LOCKED_REWARD_IDS.includes(reward.id));
}

const Gamification = {
  computePoints,
  problemKey,
  computeStreak,

  /** Add solved problems, skipping ones already logged (by key). Returns { added, pointsGained }. */
  addSolves(problems) {
    const d = Store.data;
    const existingKeys = new Set(d.solvedLog.map((p) => p.key));
    const { focusTags, gamificationStart, cfVerified } = d.profile;
    let added = 0;
    let pointsGained = 0;

    // Process oldest-first so in-batch streak bonuses (e.g. a first-ever sync spanning many
    // days) build up day by day instead of depending on whatever order the source returned.
    const newOnes = problems
      .filter((p) => !existingKeys.has(p.key || problemKey(p.contestId, p.index)))
      .sort((a, b) => new Date(a.solvedDate) - new Date(b.solvedDate));

    Store.update((data) => {
      const daysWithSolve = pointsEarningDays(data.solvedLog);

      for (const p of newOnes) {
        const key = p.key || problemKey(p.contestId, p.index);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);

        const base = computePoints(
          { rating: p.rating, tags: p.tags, solvedDate: p.solvedDate },
          { focusTags, gamificationStart, cfVerified }
        );

        let bonus = 0;
        const day = dayStr(p.solvedDate);
        if (base > 0 && !daysWithSolve.has(day)) {
          const cursor = new Date(p.solvedDate);
          cursor.setDate(cursor.getDate() - 1);
          let streakBefore = 0;
          while (daysWithSolve.has(dayStr(cursor))) {
            streakBefore++;
            cursor.setDate(cursor.getDate() - 1);
          }
          bonus = Math.min(streakBefore, STREAK_BONUS_CAP);
        }
        if (base > 0) daysWithSolve.add(day);

        const points = base + bonus;
        data.solvedLog.push({
          key,
          contestId: p.contestId ?? null,
          index: p.index ?? null,
          name: p.name || key,
          rating: p.rating ?? null,
          tags: p.tags || [],
          solvedDate: p.solvedDate,
          points,
          bonus,
          source: p.source || "manual",
        });
        data.points.balance += points;
        added++;
        pointsGained += points;
      }
    });

    if (added) document.dispatchEvent(new CustomEvent("icpc:points-changed"));
    return { added, pointsGained };
  },

  redeemReward(rewardId) {
    const d = Store.data;
    const reward = d.rewards.find((r) => r.id === rewardId);
    if (!reward) return { ok: false, reason: "not-found" };
    if (!(reward.cost > 0)) return { ok: false, reason: "invalid-reward" };
    if (d.points.balance < reward.cost) return { ok: false, reason: "insufficient-points" };

    Store.update((data) => {
      data.points.balance -= reward.cost;
      data.redemptions.unshift({
        id: `red-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        rewardId: reward.id,
        rewardName: reward.name,
        cost: reward.cost,
        date: new Date().toISOString(),
      });
    });
    document.dispatchEvent(new CustomEvent("icpc:points-changed"));
    return { ok: true };
  },

  addReward(name, cost) {
    // Re-validated here (not just at the form layer) since this is a reachable internal API —
    // a non-positive cost would let redeemReward's `balance -= reward.cost` add points instead
    // of spending them.
    const safeCost = Math.max(1, Math.round(Number(cost) || 0));
    Store.update((data) => {
      data.rewards.push({
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        cost: safeCost,
      });
    });
    document.dispatchEvent(new CustomEvent("icpc:points-changed"));
  },

  removeReward(rewardId) {
    const reward = Store.data.rewards.find((r) => r.id === rewardId);
    if (isLockedReward(reward)) return { ok: false, reason: "locked" };
    Store.update((data) => {
      data.rewards = data.rewards.filter((r) => r.id !== rewardId);
    });
    document.dispatchEvent(new CustomEvent("icpc:points-changed"));
    return { ok: true };
  },

  /** Shared streak card, used on both the Dashboard and the Self-rule page. */
  renderStreak(root) {
    if (!root) return;
    const { count, solvedToday } = computeStreak(Store.data.solvedLog);
    root.innerHTML = `
      <div class="streak-display">
        <div class="countdown-number">${count > 0 ? "&#128293; " : ""}${count}</div>
        <div class="countdown-label">day streak</div>
      </div>
      <p class="card-subtitle streak-note">
        ${
          solvedToday
            ? "Solved today &mdash; streak is safe. Nice work!"
            : "Solve 1 Codeforces problem today to maintain the streak."
        }
      </p>
    `;
  },
};
