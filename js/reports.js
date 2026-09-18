/**
 * Stats reporting: solves are split into "active" (on/after the
 * gamification start date, i.e. actually scoring points) vs "historical"
 * (imported solves from before that date — logged but non-scoring). The two
 * are never blended together.
 */
const REPORTS_DAY_MS = 24 * 60 * 60 * 1000;

const Reports = {
  _period: "active", // "active" | "historical"

  splitLog() {
    const { solvedLog } = Store.data;
    const { gamificationStart } = Store.data.profile;
    if (!gamificationStart) {
      return { active: solvedLog.slice(), historical: [] };
    }
    const active = [];
    const historical = [];
    for (const p of solvedLog) {
      if (p.solvedDate >= gamificationStart) active.push(p);
      else historical.push(p);
    }
    return { active, historical };
  },

  ratingBuckets(entries) {
    const map = new Map();
    for (const p of entries) {
      const label = p.rating ? `${Math.floor(p.rating / 100) * 100}` : "Unrated";
      map.set(label, (map.get(label) || 0) + 1);
    }
    const rated = [...map.entries()]
      .filter(([k]) => k !== "Unrated")
      .sort((a, b) => Number(a[0]) - Number(b[0]));
    const unrated = map.has("Unrated") ? [["Unrated", map.get("Unrated")]] : [];
    return [...rated, ...unrated];
  },

  topTags(entries, limit = 10) {
    const map = new Map();
    for (const p of entries) {
      for (const t of p.tags || []) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  },

  windowStats(entries) {
    const now = new Date();
    const todayStr = startOfDayStr(now);
    const sevenDaysAgo = new Date(now.getTime() - 7 * REPORTS_DAY_MS);
    let todayCount = 0,
      todayPoints = 0,
      last7Count = 0,
      last7Points = 0;
    for (const p of entries) {
      const d = new Date(p.solvedDate);
      if (startOfDayStr(d) === todayStr) {
        todayCount++;
        todayPoints += p.points;
      }
      if (d >= sevenDaysAgo) {
        last7Count++;
        last7Points += p.points;
      }
    }
    return { todayCount, todayPoints, last7Count, last7Points };
  },

  render(container) {
    container.innerHTML = "";
    const { active, historical } = this.splitLog();

    const toggle = document.createElement("div");
    toggle.className = "report-toggle";
    toggle.innerHTML = `
      <button type="button" data-period="active" class="${this._period === "active" ? "active" : ""}">Since start (${active.length})</button>
      <button type="button" data-period="historical" class="${this._period === "historical" ? "active" : ""}">Before start (${historical.length})</button>
    `;
    toggle.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._period = btn.dataset.period;
        this.render(container);
      });
    });
    container.appendChild(toggle);

    const entries = this._period === "active" ? active : historical;
    const totalPoints = entries.reduce((s, p) => s + p.points, 0);

    if (this._period === "active") {
      const w = this.windowStats(entries);
      const winBox = document.createElement("div");
      winBox.className = "report-windows";
      winBox.innerHTML = `
        <div class="stat-tile"><div class="stat-value">${w.todayCount}</div><div class="stat-label">solved today (+${w.todayPoints} pts)</div></div>
        <div class="stat-tile"><div class="stat-value">${w.last7Count}</div><div class="stat-label">solved last 7 days (+${w.last7Points} pts)</div></div>
        <div class="stat-tile"><div class="stat-value">${totalPoints}</div><div class="stat-label">total points earned</div></div>
      `;
      container.appendChild(winBox);
    } else {
      const note = document.createElement("p");
      note.className = "report-note";
      note.textContent = `${entries.length} problems solved before your gamification start date — logged for stats, worth 0 points.`;
      container.appendChild(note);
    }

    const grids = document.createElement("div");
    grids.className = "report-grids";

    const ratingCol = document.createElement("div");
    ratingCol.className = "report-col";
    ratingCol.innerHTML = `<h4>By rating</h4>`;
    const ratingList = document.createElement("div");
    ratingList.className = "bar-list";
    const buckets = this.ratingBuckets(entries);
    const maxBucket = Math.max(1, ...buckets.map(([, c]) => c));
    for (const [label, count] of buckets) {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `
        <div class="bar-row-top">
          <span class="bar-label">${label}</span>
          <span class="bar-count">${count}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${(count / maxBucket) * 100}%"></div></div>
      `;
      ratingList.appendChild(row);
    }
    if (!buckets.length) ratingList.innerHTML = `<p class="empty-note">No data yet.</p>`;
    ratingCol.appendChild(ratingList);

    const tagsCol = document.createElement("div");
    tagsCol.className = "report-col";
    tagsCol.innerHTML = `<h4>Top tags</h4>`;
    const tagsList = document.createElement("div");
    tagsList.className = "bar-list";
    const tags = this.topTags(entries);
    const maxTag = Math.max(1, ...tags.map(([, c]) => c));
    for (const [label, count] of tags) {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `
        <div class="bar-row-top">
          <span class="bar-label">${escapeHtml(label)}</span>
          <span class="bar-count">${count}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${(count / maxTag) * 100}%"></div></div>
      `;
      tagsList.appendChild(row);
    }
    if (!tags.length) tagsList.innerHTML = `<p class="empty-note">No data yet.</p>`;
    tagsCol.appendChild(tagsList);

    grids.appendChild(ratingCol);
    grids.appendChild(tagsCol);
    container.appendChild(grids);
  },
};

function startOfDayStr(d) {
  return new Date(d).toDateString();
}
