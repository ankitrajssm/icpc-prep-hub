/** Self-rule page: points overview, activity trends, the points-formula explainer, and the rewards catalog. */
(function () {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const WEEK_MS = 7 * DAY_MS;

  const ACTIVITY_WINDOWS = {
    daily: { short: "Daily", label: "today", days: 1 },
    weekly: { short: "Weekly", label: "last 7 days", days: 7 },
    monthly: { short: "Monthly", label: "last 30 days", days: 30 },
  };
  let activityWindow = "weekly";

  /** Sum `valueKey` across `entries` whose `dateKey` falls in the window: exact calendar day if `days` is 1, a rolling last-`days`-days window otherwise. */
  function sumInWindow(entries, dateKey, valueKey, days) {
    if (days === 1) {
      const todayStr = new Date().toDateString();
      return entries.filter((e) => new Date(e[dateKey]).toDateString() === todayStr).reduce((sum, e) => sum + e[valueKey], 0);
    }
    const cutoff = new Date(Date.now() - days * DAY_MS);
    return entries.filter((e) => new Date(e[dateKey]) >= cutoff).reduce((sum, e) => sum + e[valueKey], 0);
  }

  function renderActivity() {
    const root = $("points-activity-root");
    if (!root) return;
    const { solvedLog, redemptions } = Store.data;
    const { label, days } = ACTIVITY_WINDOWS[activityWindow];

    const earned = sumInWindow(solvedLog, "solvedDate", "points", days);
    const spent = sumInWindow(redemptions, "date", "cost", days);

    const spendByReward = new Map();
    for (const r of redemptions) {
      const cur = spendByReward.get(r.rewardName) || { cost: 0, count: 0 };
      cur.cost += r.cost;
      cur.count += 1;
      spendByReward.set(r.rewardName, cur);
    }
    const spendRows = [...spendByReward.entries()].sort((a, b) => b[1].cost - a[1].cost);
    const maxSpend = Math.max(1, ...spendRows.map(([, v]) => v.cost));

    root.innerHTML = `
      <div class="report-toggle" id="activity-window-toggle">
        ${Object.entries(ACTIVITY_WINDOWS)
          .map(([key, w]) => `<button type="button" data-window="${key}" class="${key === activityWindow ? "active" : ""}">${w.short}</button>`)
          .join("")}
      </div>
      <div class="report-windows">
        <div class="stat-tile"><div class="stat-value">${escapeHtml(earned)}</div><div class="stat-label">points earned (${label})</div></div>
        <div class="stat-tile"><div class="stat-value">${escapeHtml(spent)}</div><div class="stat-label">points spent (${label})</div></div>
      </div>
      <div class="report-col">
        <h4>Spent by reward (all time)</h4>
        <div class="bar-list">
          ${
            spendRows.length
              ? spendRows
                  .map(
                    ([name, v]) => `
              <div class="bar-row">
                <div class="bar-row-top">
                  <span class="bar-label">${escapeHtml(name)} <span class="bar-label-count">(${v.count}&times;)</span></span>
                  <span class="bar-count">${escapeHtml(v.cost)} pts</span>
                </div>
                <div class="bar-track"><div class="bar-fill" style="width:${(v.cost / maxSpend) * 100}%"></div></div>
              </div>`
                  )
                  .join("")
              : `<p class="empty-note">No redemptions yet.</p>`
          }
        </div>
      </div>
    `;

    root.querySelectorAll("#activity-window-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        activityWindow = btn.dataset.window;
        renderActivity();
      });
    });
  }

  function renderOverview() {
    const root = $("points-overview-root");
    if (!root) return;
    const { points, solvedLog, redemptions, rewards } = Store.data;
    const lifetimeEarned = solvedLog.reduce((sum, s) => sum + s.points, 0);
    const weekCutoff = new Date(Date.now() - WEEK_MS).toISOString().slice(0, 10);
    const thisWeek = solvedLog.filter((s) => s.solvedDate >= weekCutoff).reduce((sum, s) => sum + s.points, 0);

    const nextReward = rewards
      .filter((r) => r.cost > points.balance)
      .sort((a, b) => a.cost - b.cost)[0];

    let nextRewardHtml;
    if (nextReward) {
      const pct = Math.min(100, Math.round((points.balance / nextReward.cost) * 100));
      nextRewardHtml = `
        <div class="progress-row">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span class="progress-label">${escapeHtml(points.balance)} / ${escapeHtml(nextReward.cost)} pts</span>
        </div>
        <p class="card-subtitle">${nextReward.cost - points.balance} points to go for "${escapeHtml(nextReward.name)}".</p>
      `;
    } else if (rewards.length) {
      nextRewardHtml = `<p class="card-subtitle">You can already afford everything in your rewards list — redeem one, or add a bigger one below.</p>`;
    } else {
      nextRewardHtml = `<p class="card-subtitle">Add a reward below to start tracking progress toward it here.</p>`;
    }

    root.innerHTML = `
      <div class="report-windows">
        <div class="stat-tile"><div class="stat-value">${escapeHtml(points.balance)}</div><div class="stat-label">current balance</div></div>
        <div class="stat-tile"><div class="stat-value">${escapeHtml(lifetimeEarned)}</div><div class="stat-label">lifetime points earned</div></div>
        <div class="stat-tile"><div class="stat-value">${redemptions.length}</div><div class="stat-label">rewards redeemed</div></div>
        <div class="stat-tile"><div class="stat-value">${escapeHtml(thisWeek)}</div><div class="stat-label">points this week</div></div>
      </div>
      ${nextRewardHtml}
    `;
  }

  function renderFormula() {
    const p = Store.data.profile;
    const tags = p.focusTags && p.focusTags.length ? p.focusTags.join(", ") : "none set";
    $("formula-focus-tags").textContent = tags;
    $("formula-start-date").textContent = p.gamificationStart
      ? new Date(p.gamificationStart).toLocaleDateString()
      : "not started — verify your handle to begin";
  }

  function renderRewards() {
    RewardsUI.render($("rewards-list"), $("redemption-history"));
  }

  /**
   * Points only actually mean anything once the handle earning them is verified (see
   * gamification.js computePoints) — show a single locked notice instead of the points/activity/
   * rewards cards until then, rather than displaying a permanently-stuck-at-0 experience.
   * Returns whether points are unlocked, so callers can skip rendering their content otherwise.
   */
  function applyLockState() {
    const unlocked = Boolean(Store.data.profile.cfVerified);
    $("points-locked-card").hidden = unlocked;
    $("points-overview-card").hidden = !unlocked;
    $("points-activity-card").hidden = !unlocked;
    $("rewards-card").hidden = !unlocked;
    return unlocked;
  }

  function wireRewardsForm() {
    $("add-reward-form").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const name = $("reward-name-input").value.trim();
      const cost = Number($("reward-cost-input").value);
      if (!name || !cost || cost <= 0) return;
      Gamification.addReward(name, Math.round(cost));
      evt.target.reset();
      renderRewards();
    });
  }

  function refresh() {
    if (!Auth.isSignedIn() || !Store.isLoaded()) return;
    renderFormula();
    const unlocked = applyLockState();
    if (!unlocked) return;
    Gamification.renderStreak($("streak-root"));
    renderOverview();
    renderActivity();
    renderRewards();
  }

  function refreshPointsChange() {
    if (!Auth.isSignedIn() || !Store.isLoaded()) return;
    const unlocked = applyLockState();
    if (!unlocked) return;
    Gamification.renderStreak($("streak-root"));
    renderOverview();
    renderActivity();
  }

  // #add-reward-form is static markup wired once and never re-created — must run exactly once,
  // whether "ready" first becomes true on the initial DOMContentLoaded or later via
  // icpc:external-data-change (sign in happens after page load, through AuthUI).
  let wired = false;
  function wireOnce() {
    if (wired) return;
    wired = true;
    wireRewardsForm();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await Shell.ready;
    if (!Auth.isSignedIn() || !Store.isLoaded()) return;
    wireOnce();
    refresh();
  });
  document.addEventListener("icpc:points-changed", refreshPointsChange);

  // Sign-in/out, another device syncing, a focus-triggered refetch — see storage.js/shell.js.
  document.addEventListener("icpc:external-data-change", () => {
    if (!Auth.isSignedIn() || !Store.isLoaded()) return;
    wireOnce();
    refresh();
  });
})();
