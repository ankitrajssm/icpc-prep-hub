/**
 * Countdown + proportional pacing plan. Phases (Foundations/Core/Advanced)
 * are pooled across *all* subjects, and the remaining time to the target
 * date is split across them proportional to topic count. Progress is
 * compared against the expected pace to give an ahead/behind indicator.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PACE_PER_WEEK = 4; // fallback assumption when no target date is set

function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function daysBetweenSafe(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}
function addDays(date, days) {
  const c = new Date(date);
  c.setDate(c.getDate() + Math.round(days));
  return c;
}
function fmtDate(d) {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const Timeline = {
  render(container) {
    container.innerHTML = "";
    const { targetDate, gamificationStart } = Store.data.profile;
    const today = new Date();

    if (!targetDate) {
      this.renderFallback(container);
      return;
    }

    const target = new Date(targetDate);
    const remainingDays = daysBetweenSafe(today, target);

    if (remainingDays < 0) {
      const box = document.createElement("div");
      box.className = "timeline-box timeline-past";
      box.innerHTML = `<p><strong>Your target date (${fmtDate(target)}) has passed.</strong> Set a new one in the profile card above to get a fresh pacing plan.</p>`;
      container.appendChild(box);
      return;
    }

    const prepStart = gamificationStart ? new Date(gamificationStart) : today;
    const totalDays = Math.max(1, daysBetweenSafe(prepStart, target));
    const elapsedDays = Math.min(totalDays, Math.max(0, daysBetweenSafe(prepStart, today)));

    const countdown = document.createElement("div");
    countdown.className = "timeline-countdown";
    countdown.innerHTML = `
      <div class="countdown-number">${remainingDays}</div>
      <div class="countdown-label">day${remainingDays === 1 ? "" : "s"} until ${fmtDate(target)}</div>
    `;
    container.appendChild(countdown);

    const buckets = Roadmap.phaseBuckets();
    const totalTopics = buckets.reduce((s, b) => s + b.total, 0) || 1;

    let cumDays = 0;
    const rows = buckets.map((b) => {
      const daysAllocated = totalDays * (b.total / totalTopics);
      const startDay = cumDays;
      const endDay = cumDays + daysAllocated;
      cumDays = endDay;
      const startDate = addDays(prepStart, startDay);
      const endDate = addDays(prepStart, endDay);

      let expectedPercent;
      if (elapsedDays <= startDay) expectedPercent = 0;
      else if (elapsedDays >= endDay) expectedPercent = 100;
      else expectedPercent = Math.round(((elapsedDays - startDay) / (endDay - startDay)) * 100);

      const diff = b.percent - expectedPercent;
      let status = "on-track";
      if (diff >= 8) status = "ahead";
      else if (diff <= -8) status = "behind";

      return { ...b, startDate, endDate, expectedPercent, status, diff };
    });

    const overall = Roadmap.overallProgress();
    const overallExpected = Math.round((elapsedDays / totalDays) * 100);
    const overallDiff = overall.percent - overallExpected;
    let overallStatus = "on-track";
    if (overallDiff >= 8) overallStatus = "ahead";
    else if (overallDiff <= -8) overallStatus = "behind";

    const overallBox = document.createElement("div");
    overallBox.className = `pacing-overall status-${overallStatus}`;
    overallBox.innerHTML = `
      <span class="pacing-badge">${statusLabel(overallStatus)}</span>
      <span>You're at <strong>${overall.percent}%</strong> of the full roadmap; expected pace by today is <strong>${overallExpected}%</strong>.</span>
    `;
    container.appendChild(overallBox);

    const table = document.createElement("div");
    table.className = "pacing-table";
    for (const row of rows) {
      const rowEl = document.createElement("div");
      rowEl.className = `pacing-row status-${row.status}`;
      rowEl.innerHTML = `
        <div class="pacing-phase">${row.phase}</div>
        <div class="pacing-window">${fmtDate(row.startDate)} – ${fmtDate(row.endDate)}</div>
        <div class="progress-row">
          <div class="progress-bar"><div class="progress-fill" style="width:${row.percent}%"></div></div>
          <span class="progress-label">${row.done}/${row.total} (${row.percent}%)</span>
        </div>
        <div class="pacing-badge">${statusLabel(row.status)}</div>
      `;
      table.appendChild(rowEl);
    }
    container.appendChild(table);
  },

  renderFallback(container) {
    const overall = Roadmap.overallProgress();
    const remaining = overall.total - overall.done;
    const weeks = Math.max(1, Math.ceil(remaining / DEFAULT_PACE_PER_WEEK));
    const box = document.createElement("div");
    box.className = "timeline-box timeline-fallback";
    box.innerHTML = `
      <p>No target contest date set. Add one in the profile card above for a real countdown and pacing plan.</p>
      <p>Rough estimate: at a default pace of <strong>${DEFAULT_PACE_PER_WEEK} topics/week</strong>, finishing the remaining <strong>${remaining}</strong> topics would take about <strong>${weeks} week${weeks === 1 ? "" : "s"}</strong>.</p>
    `;
    container.appendChild(box);
  },
};

function statusLabel(status) {
  if (status === "ahead") return "↑ Ahead of pace";
  if (status === "behind") return "↓ Behind pace";
  return "→ On track";
}
