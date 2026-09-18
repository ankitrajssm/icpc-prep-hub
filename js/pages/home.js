/** Home page: a small progress teaser plus links into the rest of the app. Auth-optional — degrades
 * to a sign-in prompt instead of hard-gating, since this is the de facto landing page. */
(function () {
  function render() {
    const root = $("home-progress-root");
    if (!root) return;

    if (!Auth.isSignedIn()) {
      root.innerHTML = `<p class="card-subtitle">Sign in on the <a href="dashboard.html">Dashboard</a> to track your progress here.</p>`;
      return;
    }
    if (!Store.isLoaded()) return; // Shell.ready hasn't resolved Store.load() yet; icpc:external-data-change will re-render

    const overall = Roadmap.overallProgress();
    const points = Store.data.points.balance;
    const solvedCount = Store.data.solvedLog.length;
    const hasStarted = overall.done > 0 || points > 0 || solvedCount > 0;

    root.innerHTML = `
      <div class="report-windows">
        <div class="stat-tile"><div class="stat-value">${escapeHtml(points)}</div><div class="stat-label">points</div></div>
        <div class="stat-tile"><div class="stat-value">${overall.percent}%</div><div class="stat-label">roadmap complete</div></div>
        <div class="stat-tile"><div class="stat-value">${solvedCount}</div><div class="stat-label">problems solved</div></div>
      </div>
      <p class="card-subtitle">
        ${hasStarted ? "Keep going — check the Dashboard for your full timeline and pacing." : "Head to the Dashboard to set up your profile and get started."}
      </p>
    `;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await Shell.ready;
    render();
  });

  // Sign-in/out, another device syncing, a focus-triggered refetch — see storage.js/shell.js.
  document.addEventListener("icpc:external-data-change", render);
})();
