/**
 * Codeforces Analysis card: tag-ratio-vs-baseline comparison (js/cf-baseline.js),
 * accuracy per tag, rating trajectory, and unsolved/attempted problems — all
 * driven by Store.data.cf.* populated during sync (js/cf-sync.js).
 */
const CFAnalysis = {
  _section: "profile", // "profile" | "compare" — which of the two top-level groups is shown
  _tier: "tourist",
  _window: "lastYear",
  _compareHandle: "jiangly", // pre-filled default; overwritten with the last handle successfully compared against
  _compareProblems: null, // that handle's fetched (unfiltered) solved problems, cached to avoid re-fetching on window toggle
  _compareError: null,
  _histogramTag: "all",

  // Same duplicated constants as TeamAnalysis (js/cf-team-analysis.js topicRatings) — the two
  // pages/modules don't otherwise depend on each other, so these are small justified duplicates,
  // not shared imports.
  TAG_RATING_RECENT_WINDOW: 30, // per-tag histogram/avg only looks at your most recent this-many solves in that tag
  TAG_RATING_LOW_CONFIDENCE_SAMPLE: 10, // fewer solves than this actually going into the average = shown, but flagged as noisy

  /**
   * Rating-weighted average: each solve's contribution is weighted by the SQUARE of its own
   * rating, so harder solves count proportionally more than easier ones — a plain mean has a
   * real failure mode here (100 solves ground out at 800 early on would keep averaging down to
   * ~800-ish even after someone's moved on to solving 1700-1800s), and weighting by rating pulls
   * the number toward what someone can *currently* solve instead. Used only for the profile-wide
   * "avg. solved rating" stat (all tags, no cluster concept applies) — the tag-filtered histogram
   * below uses clusterWeightedAvgRating() instead, which builds on this same weighting. Same
   * formula as TeamAnalysis.weightedAvgRating (js/cf-team-analysis.js), duplicated for the same
   * reason as the constants above.
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
   * solve's exact rating. Each solve's density = count of solves at that same rating (including
   * itself); that density multiplies into the existing rating² weight. An earlier version
   * smoothed "closeness" continuously via a Gaussian kernel (kernel density estimation), to avoid
   * a hard bucket boundary splitting two very-close ratings apart — but Codeforces problem
   * ratings only ever land on exact multiples of 100, never in between, so there's no continuous
   * boundary to smooth over. Tested directly: smoothing only diluted the signal (a real 10-of-30
   * cluster scored lower the more it blurred nearby-but-different ratings together), so exact-
   * rating counting — the smoothing's own bandwidth-to-zero limit — measurably won out. Fixes
   * what plain rating-squared weighting can't: a single high-rated solve amid a pile of much
   * easier ones still got full credit for its own magnitude there, undiluted by having no
   * company; here its density stays 1, so it barely outweighs the easier cluster's r²×N, while a
   * genuine cluster of solves at the same high rating (repeated evidence, not a one-off) pulls
   * the average solidly toward it. Same formula as TeamAnalysis.clusterWeightedAvgRating
   * (js/cf-team-analysis.js).
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

  // Approximate real Codeforces rating-tier colors, checked high-to-low. Purely cosmetic (ties a
  // bar's color to the difficulty band it represents, same idea as the site's own color-coded
  // handles), not tied to the app's `--accent`/`--secondary` theme tokens on purpose — these are
  // meant to read as "Codeforces colors," which stay fixed regardless of light/dark theme.
  RATING_COLOR_BANDS: [
    [3000, "#7f1d1d"], // Legendary Grandmaster
    [2400, "#e02b2b"], // Grandmaster / International Grandmaster
    [2100, "#f0a020"], // Master / International Master
    [1900, "#b23bcf"], // Candidate Master
    [1600, "#3366ff"], // Expert
    [1400, "#17a2b8"], // Specialist
    [1200, "#2eb82e"], // Pupil
    [0, "#8a8a8a"], // Newbie
  ],

  ratingColor(rating) {
    for (const [cutoff, color] of this.RATING_COLOR_BANDS) {
      if (rating >= cutoff) return color;
    }
    return this.RATING_COLOR_BANDS[this.RATING_COLOR_BANDS.length - 1][1];
  },

  TIERS: [
    { id: "tourist", label: "Tourist" },
    { id: "top500", label: "Top 500" },
    { id: "top10000", label: "Top 10,000" },
    { id: "average", label: "Average user" },
    { id: "compare", label: "Compare with someone" },
  ],
  WINDOWS: [
    { id: "lastYear", label: "Last year" },
    { id: "allTime", label: "All time" },
  ],

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

  rankTitle(rating) {
    if (rating == null) return null;
    for (const [cutoff, title] of this.RANK_TITLES) {
      if (rating >= cutoff) return title;
    }
    return null;
  },

  render(container) {
    if (!container) return;
    // The 4 cohort tiers need the server-synced baseline table, but NOT sign-in — cf_baseline_data
    // and cf_percentiles are public-read tables (RLS policy `using (true)`, checked against the
    // actual migration this session), so the anon Supabase client can read them whether or not
    // anyone's signed in. The only real requirement is that this deployment has Supabase
    // configured at all (CLOUD_ENABLED) — a fully local-only deployment (no Supabase project)
    // genuinely has no server anywhere to serve this data from, so "Compare with someone" (a
    // public Codeforces API call, no backend needed) is the only tier that still works there.
    const canUseCloudTiers = CLOUD_ENABLED;
    const visibleTiers = canUseCloudTiers ? this.TIERS : this.TIERS.filter((t) => t.id === "compare");
    if (!canUseCloudTiers) this._tier = "compare";
    // Profile analysis reflects Store.data.solvedLog, which now only ever populates via a verified
    // sync (see js/pages/codeforces.js applyLockState) — an unverified profile's solvedLog is
    // always empty, so there's nothing real to show there yet. Force Comparison instead of letting
    // someone tab into an all-zeros "Profile analysis" with no explanation why.
    const verified = Boolean(Store.data.profile.cfVerified);
    if (!verified) this._section = "compare";
    container.innerHTML = `
      <div id="cf-summary-root"></div>

      <div class="report-toggle" id="cf-section-toggle">
        ${verified ? `<button type="button" data-section="profile" class="${this._section === "profile" ? "active" : ""}">Profile analysis</button>` : ""}
        <button type="button" data-section="compare" class="${this._section === "compare" ? "active" : ""}">Comparison</button>
      </div>

      <div id="cf-profile-section" ${verified && this._section === "profile" ? "" : "hidden"}>
        <h3 class="cf-group-heading">Profile analysis</h3>
        <p class="card-subtitle">Your own solve history.</p>
        <div class="cf-analysis-section">
          <h3>Accuracy per tag</h3>
          <p class="card-subtitle">Your accuracy by tag &mdash; the share of submissions on problems you solved that were correct, plus the average wrong attempts before AC (lower is better; needs at least 2 solves in a tag to show).</p>
          <div id="cf-accuracy-root" class="bar-list"></div>
        </div>
        <div class="cf-analysis-section">
          <h3>Problem ratings</h3>
          <p class="card-subtitle">How many solved problems fall in each difficulty band, colored like Codeforces' own rating tiers &mdash; optionally filtered to a single tag. When filtered to one tag, the Topic Wise Rating figure is weighted toward harder solves, limited to your most recent ${this.TAG_RATING_RECENT_WINDOW} solves in that tag (so an old pile of easy solves can't drag it down, and a barely-touched tag isn't unfairly inflated just for missing that old volume), AND boosted by clustering &mdash; a solve that's part of a real group of similarly-rated solves counts for more than an equally-hard one-off, so one lucky high solve can't single-handedly pull the number up, but a genuine run of solves at a similar high difficulty will. A &#9888; means that tag's sample is thin (under ${this.TAG_RATING_LOW_CONFIDENCE_SAMPLE} solves) &mdash; solve more of it for a steadier number.</p>
          <div id="cf-rating-histogram-root"></div>
        </div>
        <div class="cf-analysis-section">
          <h3>Codeforces Rating trajectory</h3>
          <div id="cf-rating-chart-root"></div>
        </div>
        <div class="cf-analysis-section">
          <h3>Solve activity</h3>
          <div id="cf-heatmap-root"></div>
        </div>
        <div class="cf-analysis-section">
          <h3>Unsolved / attempted</h3>
          <p class="card-subtitle">Problems you've tried but haven't solved yet &mdash; ready-made practice targets.</p>
          <div id="cf-unsolved-root" class="solved-log"></div>
        </div>
      </div>

      <div id="cf-compare-section" ${this._section === "compare" ? "" : "hidden"}>
        <h3 class="cf-group-heading">Comparison</h3>
        <p class="card-subtitle">How your tag mix stacks up against a baseline, and what to solve next based on the gap.</p>
        <div class="report-toggle" id="cf-tier-toggle">
          ${visibleTiers.map((t) => `<button type="button" data-tier="${t.id}" class="${t.id === this._tier ? "active" : ""}">${t.label}</button>`).join("")}
        </div>
        ${
          canUseCloudTiers
            ? ""
            : `<p class="card-subtitle">This deployment doesn't have cloud sync configured, so there's no server anywhere to serve the Tourist / Top 500 / Top 10,000 / Average-user sample data from. "Compare with someone" still works — it's just a live public Codeforces API call, no backend needed.</p>`
        }
        <div class="report-toggle" id="cf-window-toggle">
          ${this.WINDOWS.map((w) => `<button type="button" data-window="${w.id}" class="${w.id === this._window ? "active" : ""}">${w.label}</button>`).join("")}
        </div>
        <div class="cf-analysis-section">
          <h3>Your tag mix vs. the baseline</h3>
          <p class="card-subtitle">
            Each percentage is the share of <strong>solved problems that have this tag</strong>
            &mdash; e.g. "40% vs 45%" means 40% of everything <em>you've</em> solved is tagged this
            way, vs 45% of theirs. It's a mix comparison, not an accuracy or match score.
          </p>
          <p class="card-subtitle" id="cf-baseline-subtitle"></p>
          <div id="cf-baseline-root"></div>
        </div>
        <div class="cf-analysis-section">
          <h3>Next problem recommendations</h3>
          <p class="card-subtitle">Unsolved problems in your weak tags (from the comparison above), just above a target rating blended from your current Codeforces Rating and what you've actually been solving lately.</p>
          <button id="cf-recommend-btn" type="button" class="btn-secondary">Get recommendations</button>
          <span id="cf-recommend-status" class="sync-status"></span>
          <div id="cf-recommend-root" class="solved-log"></div>
        </div>
      </div>
    `;

    $("cf-recommend-btn").addEventListener("click", () => this.handleRecommend());

    container.querySelectorAll("#cf-section-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._section = btn.dataset.section;
        this.render(container);
      });
    });
    container.querySelectorAll("#cf-tier-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._tier = btn.dataset.tier;
        this.render(container);
      });
    });
    container.querySelectorAll("#cf-window-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._window = btn.dataset.window;
        this.render(container);
      });
    });

    this.renderSummary($("cf-summary-root"));
    this.renderBaseline($("cf-baseline-root"), $("cf-baseline-subtitle"));
    this.renderAccuracy($("cf-accuracy-root"));
    this.renderRatingChart($("cf-rating-chart-root"));
    this.renderRatingHistogram($("cf-rating-histogram-root"));
    this.renderHeatmap($("cf-heatmap-root"));
    this.renderUnsolved($("cf-unsolved-root"));
    $("cf-recommend-root").innerHTML = "";
  },

  /** Weak tags from the currently-selected tier/window, for the recommendation filter. */
  currentWeakTags() {
    const result = CFBaseline.compareTags({ tier: this._tier, window: this._window });
    return result.rows.filter((r) => r.verdict === "weak").map((r) => r.tag);
  },

  async handleRecommend() {
    const statusEl = $("cf-recommend-status");
    const root = $("cf-recommend-root");
    if (!CLOUD_ENABLED || !CFBaseline.isLoaded() || this._tier === "compare") {
      statusEl.textContent = 'Select a baseline tier above (not "Compare with someone") first — recommendations are based on your weak tags from there.';
      statusEl.className = "sync-status error";
      return;
    }
    const weakTags = this.currentWeakTags();
    if (!weakTags.length) {
      statusEl.textContent = "No weak tags found for this tier/window — nothing specific to recommend against.";
      statusEl.className = "sync-status error";
      return;
    }
    const targetRating = CFRecommend.computeTargetRating();
    statusEl.textContent = "Fetching the problem set…";
    statusEl.className = "sync-status";
    const result = await CFRecommend.fetchRecommendations({ weakTags, targetRating });
    if (!result.ok) {
      statusEl.textContent = `Failed: ${result.error}`;
      statusEl.className = "sync-status error";
      return;
    }
    if (!result.problems.length) {
      statusEl.textContent = `No unsolved problems found rated ${result.low}–${result.high} in: ${weakTags.join(", ")}.`;
      statusEl.className = "sync-status";
      root.innerHTML = "";
      return;
    }
    statusEl.textContent = `${result.problems.length} problems rated ${result.low}–${result.high}, tagged: ${weakTags.join(", ")}.`;
    statusEl.className = "sync-status success";
    root.innerHTML = result.problems
      .map((p) => {
        const tagsLabel = (p.tags || []).slice(0, 4).join(", ");
        return `
          <div class="solved-row">
            <span class="solved-key"><a href="https://codeforces.com/problemset/problem/${encodeURIComponent(p.contestId)}/${encodeURIComponent(p.index)}" target="_blank" rel="noopener noreferrer">${escapeHtml(`${p.contestId}${p.index}`)}</a></span>
            <span class="solved-name">${escapeHtml(p.name)}</span>
            <span class="solved-rating">${escapeHtml(p.rating)}</span>
            <span class="solved-tags">${escapeHtml(tagsLabel)}</span>
          </div>`;
      })
      .join("");
  },

  renderHeatmap(root) {
    const counts = {};
    for (const p of Store.data.solvedLog) {
      const day = p.solvedDate.slice(0, 10);
      counts[day] = (counts[day] || 0) + 1;
    }
    if (!Object.keys(counts).length) {
      root.innerHTML = `<p class="empty-note">No solves logged yet.</p>`;
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 370); // ~53 weeks back
    start.setDate(start.getDate() - start.getDay()); // align to a Sunday

    const cells = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10);
      cells.push({ date: key, count: counts[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const level = (c) => (c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c <= 6 ? 3 : 4);
    const totalSolves = cells.reduce((s, c) => s + c.count, 0);
    const activeDays = cells.filter((c) => c.count > 0).length;

    root.innerHTML = `
      <div class="heatmap-grid">
        ${cells.map((c) => `<div class="heatmap-cell level-${level(c.count)}" title="${c.date}: ${c.count} solve${c.count === 1 ? "" : "s"}"></div>`).join("")}
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        <span class="heatmap-cell level-0"></span>
        <span class="heatmap-cell level-1"></span>
        <span class="heatmap-cell level-2"></span>
        <span class="heatmap-cell level-3"></span>
        <span class="heatmap-cell level-4"></span>
        <span>More</span>
      </div>
      <p class="card-subtitle">${totalSolves} solve${totalSolves === 1 ? "" : "s"} logged across ${activeDays} active day${activeDays === 1 ? "" : "s"} in the last year.</p>
    `;
  },

  renderSummary(root) {
    const { solvedLog, cf } = Store.data;
    const ratedSolves = solvedLog.filter((p) => p.rating);
    // Rating-weighted (see weightedAvgRating below) — same formula the "Problem ratings" histogram
    // uses for its "All tags" view (not its tag-filtered view, which additionally clusters — see
    // clusterWeightedAvgRating), so this stays in agreement with "All tags" instead of quietly
    // disagreeing on the same page.
    const avgRating = ratedSolves.length ? Math.round(this.weightedAvgRating(ratedSolves.map((p) => p.rating))) : null;
    const currentRating = cf.ratingHistory.length ? cf.ratingHistory[cf.ratingHistory.length - 1].newRating : null;
    const rank = this.rankTitle(currentRating);

    root.innerHTML = `
      <div class="report-windows">
        <div class="stat-tile"><div class="stat-value">${solvedLog.length}</div><div class="stat-label">total solved</div></div>
        <div class="stat-tile"><div class="stat-value">${avgRating ?? "—"}</div><div class="stat-label">avg. solved rating</div></div>
        <div class="stat-tile"><div class="stat-value">${currentRating ?? "—"}</div><div class="stat-label">${rank ? `Codeforces Rating (${rank})` : "Codeforces Rating"}</div></div>
        <div class="stat-tile"><div class="stat-value">${cf.ratingHistory.length}</div><div class="stat-label">contests synced</div></div>
      </div>
    `;
  },

  /**
   * Legend + the actual bar rows — shared by the cohort-tier comparison and the "compare with
   * someone" tier. `otherLabel` names whoever/whatever the "baseline" side actually is (a
   * specific player's handle for Compare, or "avg"/"tourist" for the other tiers) so the
   * per-row count doesn't call a single named player's numbers an "avg". `useActualCount`
   * shows each row's real, whole-number `theirCount` instead of the fractional `expectedCount`
   * (their ratio rescaled onto *your* total) — only available when comparing against one
   * specific player whose raw per-tag counts we actually fetched (not the sampled-cohort
   * tiers, which only ever have an averaged ratio to work with).
   */
  renderComparisonRowsHtml(rows, otherLabel, useActualCount) {
    const maxRatio = Math.max(0.01, ...rows.map((r) => Math.max(r.yourRatio, r.baselineRatio)));
    const pct = (r) => Math.round(r * 100);
    const verdictColor = (r) => (r.hue === null ? "var(--text-muted)" : `hsl(${r.hue.toFixed(0)}, 68%, 50%)`);
    return `
      <div class="cf-legend">
        <span><span class="cf-legend-swatch" style="background:var(--text-muted);opacity:.35"></span>Baseline</span>
        <span class="cf-gradient-legend">
          <span class="cf-gradient-bar"></span>
          <span class="cf-gradient-labels"><span>Weak</span><span>On-par</span><span>Strong</span></span>
        </span>
      </div>
      <div class="bar-scroll">
        ${rows
          .map((r) => {
            const color = verdictColor(r);
            const otherCount = useActualCount ? r.theirCount : r.expectedCount.toFixed(1);
            const pctTitle = `${pct(r.yourRatio)}% of your solves are tagged "${r.tag}", vs ${pct(r.baselineRatio)}% of ${otherLabel}'s.`;
            return `
          <div class="bar-row-compare">
            <div class="bar-row-top">
              <span class="bar-label">${escapeHtml(r.tag)} <span class="bar-label-count">(${r.yourCount} you / ${otherCount} ${escapeHtml(otherLabel)})</span></span>
              <span class="bar-verdict" style="color:${color}" title="${escapeHtml(pctTitle)}">${pct(r.yourRatio)}% vs ${pct(r.baselineRatio)}%</span>
            </div>
            <div class="bar-track-dual">
              <div class="bar-fill-baseline" style="width:${(r.baselineRatio / maxRatio) * 100}%"></div>
              <div class="bar-fill-mine" style="width:${(r.yourRatio / maxRatio) * 100}%;background:${color}"></div>
              <div class="bar-marker" style="left:${(r.baselineRatio / maxRatio) * 100}%"></div>
            </div>
          </div>`;
          })
          .join("")}
      </div>
    `;
  },

  renderCompareTier(root, subtitleEl) {
    subtitleEl.textContent = "Paste any public Codeforces handle to compare your tag mix against theirs — nothing is synced or stored, it's fetched fresh each time.";

    let resultHtml = "";
    if (this._compareError) {
      resultHtml = `<p class="sync-status error">${escapeHtml(this._compareError)}</p>`;
    } else if (this._compareProblems) {
      const result = CFBaseline.compareWithHandleProblems({ handle: this._compareHandle, problems: this._compareProblems, window: this._window });
      if (!result.ok) {
        resultHtml = `<p class="sync-status error">${escapeHtml(result.error)}</p>`;
      } else if (result.insufficientData) {
        resultHtml = `<p class="empty-note">Log or sync at least 5 of your own solves in this window to see a comparison (you have ${result.yourTotal}).</p>`;
      } else {
        const windowLabel = this._window === "lastYear" ? "last year" : "all time";
        resultHtml = `
          <div class="report-windows cf-totals">
            <div class="stat-tile"><div class="stat-value">${result.yourTotal}</div><div class="stat-label">you solved (${windowLabel})</div></div>
            <div class="stat-tile"><div class="stat-value">${result.theirTotal}</div><div class="stat-label">${escapeHtml(result.theirHandle)} solved (${windowLabel})</div></div>
          </div>
          ${this.renderComparisonRowsHtml(result.rows, result.theirHandle, true)}
        `;
      }
    }

    root.innerHTML = `
      <div class="sync-actions">
        <input type="text" id="cf-compare-handle-input" class="compare-handle-input" placeholder="e.g. tourist" value="${escapeHtml(this._compareHandle)}" />
        <button id="cf-compare-btn" type="button" class="btn-secondary">Compare</button>
        <span id="cf-compare-status" class="sync-status"></span>
      </div>
      ${resultHtml}
    `;

    $("cf-compare-btn").addEventListener("click", () => this.handleCompare());
    $("cf-compare-handle-input").addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        this.handleCompare();
      }
    });
  },

  async handleCompare() {
    const handle = $("cf-compare-handle-input").value.trim();
    const statusEl = $("cf-compare-status");
    if (!handle) {
      statusEl.textContent = "Enter a handle first.";
      statusEl.className = "sync-status error";
      return;
    }
    statusEl.textContent = "Fetching…";
    statusEl.className = "sync-status";
    const result = await CFBaseline.fetchHandleProblems(handle);
    if (!result.ok) {
      this._compareProblems = null;
      this._compareError = `Couldn't fetch ${handle}: ${result.error}`;
    } else {
      this._compareHandle = handle;
      this._compareProblems = result.problems;
      this._compareError = null;
    }
    this.render($("cf-analysis-root"));
  },

  async renderBaseline(root, subtitleEl) {
    if (this._tier === "compare") {
      this.renderCompareTier(root, subtitleEl);
      return;
    }
    if (!CFBaseline.isLoaded()) {
      subtitleEl.textContent = "Loading…";
      root.innerHTML = `<p class="empty-note">Loading baseline data…</p>`;
      try {
        await CFBaseline.ensureLoaded();
      } catch (e) {
        subtitleEl.textContent = "";
        root.innerHTML = `<p class="empty-note">Couldn't load baseline data: ${escapeHtml(e.message)}</p>`;
        return;
      }
    }

    const result = CFBaseline.compareTags({ tier: this._tier, window: this._window });
    let cutoffLabel;
    if (this._tier === "tourist") cutoffLabel = "a specific named player";
    else if (this._tier === "average") cutoffLabel = `~${result.ratingCutoff} rated`;
    else cutoffLabel = `${result.ratingCutoff}+ rated`;
    const sampleNote = this._tier === "tourist" ? "" : `, averaged across 500 real sampled players, updated daily`;
    subtitleEl.textContent = `${result.tierLabel} (${cutoffLabel}${sampleNote})`;

    if (!result.sampleSize) {
      root.innerHTML = `<p class="empty-note">No baseline data for this window yet.</p>`;
      return;
    }
    if (result.insufficientData) {
      root.innerHTML = `<p class="empty-note">Log or sync at least 5 solves in this window to see a comparison (you have ${result.yourTotal}).</p>`;
      return;
    }

    const windowLabel = this._window === "lastYear" ? "last year" : "all time";
    const totalsLabel = this._tier === "tourist" ? `Tourist solved (${windowLabel})` : `${result.tierLabel} avg. solved (${windowLabel})`;
    const otherLabel = this._tier === "tourist" ? "tourist" : "avg";

    root.innerHTML = `
      <div class="report-windows cf-totals">
        <div class="stat-tile"><div class="stat-value">${result.yourTotal}</div><div class="stat-label">you solved (${windowLabel})</div></div>
        <div class="stat-tile"><div class="stat-value">${result.avgSolvedCount}</div><div class="stat-label">${totalsLabel}</div></div>
      </div>
      ${this.renderComparisonRowsHtml(result.rows, otherLabel, this._tier === "tourist")}
    `;
  },

  renderAccuracy(root) {
    const { solvedLog, cf } = Store.data;
    const tagStats = {};
    for (const p of solvedLog) {
      const wrong = cf.attemptStats[p.key] || 0;
      for (const tag of p.tags || []) {
        if (!tagStats[tag]) tagStats[tag] = { totalWrong: 0, count: 0 };
        tagStats[tag].totalWrong += wrong;
        tagStats[tag].count += 1;
      }
    }
    const rows = Object.entries(tagStats)
      .map(([tag, s]) => {
        const avgWrong = s.count ? s.totalWrong / s.count : 0;
        // Of every submission on a problem you eventually solved in this tag (the AC plus
        // whatever wrong attempts came before it), what fraction were first-try-or-eventually
        // correct submissions — i.e. your real accuracy, not just an average mistake count.
        const accuracyPct = (s.count / (s.count + s.totalWrong)) * 100;
        return { tag, avgWrong, accuracyPct, count: s.count };
      })
      .filter((r) => r.count >= 2)
      .sort((a, b) => b.avgWrong - a.avgWrong);

    if (!rows.length) {
      root.innerHTML = `<p class="empty-note">Sync your Codeforces handle above to see this (needs at least 2 solves in a tag).</p>`;
      return;
    }
    const maxAvg = Math.max(0.01, ...rows.map((r) => r.avgWrong));
    root.innerHTML = `<div class="bar-scroll">${rows
      .map(
        (r) => `
      <div class="bar-row">
        <div class="bar-row-top">
          <span class="bar-label">${escapeHtml(r.tag)} <span class="bar-label-count">(${r.count} solved)</span></span>
          <span class="bar-count">${r.accuracyPct.toFixed(0)}% accuracy &middot; ${r.avgWrong.toFixed(1)} wrong/solve</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${(r.avgWrong / maxAvg) * 100}%"></div></div>
      </div>`
      )
      .join("")}</div>`;
  },

  /**
   * Rating trajectory chart: a polyline over each rated contest, with a right-side rating axis
   * (gridlines snapped to round numbers, like a real rating graph) and a continuous hover — move
   * anywhere over the chart and a dashed guide + highlighted dot track the nearest contest, with
   * its rating shown in a floating tooltip. Continuous cursor tracking rather than a per-point
   * `title` for the same reason as the Team Analyzer's tag-rating bars (see wireRatingChartHover):
   * a 3px dot is a thin, easy-to-miss target, and a native title has no way to show a highlighted
   * point alongside it.
   */
  renderRatingChart(root) {
    const history = Store.data.cf.ratingHistory;
    if (!history.length) {
      root.innerHTML = `<p class="empty-note">Sync your Codeforces handle above to see your Codeforces Rating trajectory.</p>`;
      return;
    }
    const width = 640;
    const height = 180;
    const paddingLeft = 10;
    const paddingRight = 46; // room for the right-side rating axis labels
    const paddingTop = 14;
    const paddingBottom = 14;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    const n = history.length;
    const ratings = history.map((h) => h.newRating);
    const minR = Math.min(...ratings) - 50;
    const maxR = Math.max(...ratings) + 50;
    const x = (i) => paddingLeft + (i / Math.max(1, n - 1)) * plotWidth;
    const y = (r) => paddingTop + plotHeight - ((r - minR) / (maxR - minR)) * plotHeight;
    const points = history.map((h, i) => `${x(i)},${y(h.newRating)}`).join(" ");
    const last = history[n - 1];
    const percentile = CFBaseline.percentileForRating(last.newRating);
    const percentileLabel = percentile ? ` · top ~${percentile}% of active rated Codeforces users` : "";
    const rank = this.rankTitle(last.newRating);
    const rankLabel = rank ? ` (${rank})` : "";

    const peak = history.reduce((m, h) => Math.max(m, h.newRating), -Infinity);
    const peakLabel = peak > last.newRating ? ` · peak ${peak}` : "";

    // Right-side rating marks: ~4 gridlines snapped to a round step (100, 200, 500...) so the
    // labels read like real rating milestones instead of arbitrary numbers off the exact min/max.
    const rawStep = (maxR - minR) / 4;
    const step = Math.max(100, Math.round(rawStep / 100) * 100);
    const firstTick = Math.ceil(minR / step) * step;
    const ticks = [];
    for (let t = firstTick; t <= maxR; t += step) ticks.push(t);

    root.innerHTML = `
      <div class="rating-chart-wrap">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Codeforces Rating over ${n} contest${n === 1 ? "" : "s"}, ending at ${last.newRating}" id="cf-rating-svg">
          ${ticks
            .map(
              (t) => `
            <line x1="${paddingLeft}" x2="${width - paddingRight}" y1="${y(t)}" y2="${y(t)}" class="rating-chart-gridline" />
            <text x="${width - paddingRight + 6}" y="${y(t) + 3}" class="rating-chart-axis-label">${t}</text>
          `
            )
            .join("")}
          <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          ${history.map((h, i) => `<circle cx="${x(i)}" cy="${y(h.newRating)}" r="3" fill="var(--accent)" />`).join("")}
          <line id="cf-rating-hover-line" x1="0" x2="0" y1="${paddingTop}" y2="${height - paddingBottom}" class="rating-chart-hover-line" hidden />
          <circle id="cf-rating-hover-dot" r="5" class="rating-chart-hover-dot" hidden />
        </svg>
      </div>
      <p class="card-subtitle">${n} contest${n === 1 ? "" : "s"} · Codeforces Rating ${last.newRating}${rankLabel}${peakLabel}${percentileLabel}</p>
    `;
    this.wireRatingChartHover(root, history, { x, y, paddingLeft, plotWidth, width });
  },

  /**
   * Continuous mousemove over the chart: maps cursor X back to the nearest contest index (not
   * pixel-hunting for a 3px circle), then moves the dashed guide line + highlighted dot there and
   * shows a floating tooltip with that contest's name, old→new rating, and date. Mirrors
   * TeamAnalysis's wireRatingTooltips (js/cf-team-analysis.js) — same continuous-cursor-tracking
   * approach, applied to a line chart's X axis instead of a bar's rating axis.
   */
  wireRatingChartHover(root, history, { x, y, paddingLeft, plotWidth, width }) {
    const svg = root.querySelector("#cf-rating-svg");
    const hoverLine = root.querySelector("#cf-rating-hover-line");
    const hoverDot = root.querySelector("#cf-rating-hover-dot");
    const n = history.length;

    svg.addEventListener("mousemove", (evt) => {
      const rect = svg.getBoundingClientRect();
      const svgX = rect.width ? ((evt.clientX - rect.left) / rect.width) * width : 0;
      const frac = plotWidth ? Math.max(0, Math.min(1, (svgX - paddingLeft) / plotWidth)) : 0;
      const i = Math.round(frac * (n - 1));
      const h = history[i];

      hoverLine.setAttribute("x1", x(i));
      hoverLine.setAttribute("x2", x(i));
      hoverLine.hidden = false;
      hoverDot.setAttribute("cx", x(i));
      hoverDot.setAttribute("cy", y(h.newRating));
      hoverDot.hidden = false;

      const date = new Date(h.ratingUpdateTimeSeconds * 1000).toLocaleDateString();
      this.showFloatingTooltip(evt.clientX, evt.clientY, `${h.contestName} — ${h.oldRating} → ${h.newRating} (${date})`);
    });
    svg.addEventListener("mouseleave", () => {
      hoverLine.hidden = true;
      hoverDot.hidden = true;
      this.hideFloatingTooltip();
    });
  },

  /** Shared floating tooltip element (see .floating-tooltip in styles.css) — same pattern as TeamAnalysis's. */
  ensureFloatingTooltipEl() {
    let el = document.getElementById("cf-floating-tooltip");
    if (!el) {
      el = document.createElement("div");
      el.id = "cf-floating-tooltip";
      el.className = "floating-tooltip";
      el.hidden = true;
      document.body.appendChild(el);
    }
    return el;
  },

  showFloatingTooltip(clientX, clientY, text) {
    const el = this.ensureFloatingTooltipEl();
    el.textContent = text;
    el.hidden = false;
    const left = Math.min(clientX + 14, window.innerWidth - el.offsetWidth - 8);
    const top = Math.min(clientY + 14, window.innerHeight - el.offsetHeight - 8);
    el.style.left = `${Math.max(4, left)}px`;
    el.style.top = `${Math.max(4, top)}px`;
  },

  hideFloatingTooltip() {
    const el = document.getElementById("cf-floating-tooltip");
    if (el) el.hidden = true;
  },

  /** Distinct tags across the synced solved log, most-solved first — for the histogram's tag filter. */
  histogramTagOptions() {
    const counts = {};
    for (const p of Store.data.solvedLog) {
      for (const tag of cfBaselineCleanTags(p.tags)) counts[tag] = (counts[tag] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  },

  /**
   * Histogram of solved-problem count by rating (100-wide buckets), optionally filtered to one
   * tag. Bars are colored like real Codeforces rating tiers (see RATING_COLOR_BANDS) so the
   * difficulty band reads at a glance the way a CF handle color does. Bucket range is trimmed to
   * [min, max] of whatever's actually in the filtered data, not a fixed 800-3500 span, so someone
   * who's only solved up to 1800 doesn't see a long empty tail.
   *
   * When filtered to one specific tag, both the bars and the avg. rating figure are built from
   * only your most recent TAG_RATING_RECENT_WINDOW solves in that tag, not your whole history in
   * it — see js/cf-team-analysis.js topicRatings() for the full reasoning (same fix, same window
   * size, applied here too so the two pages never quietly disagree). "All tags" stays unwindowed
   * on purpose — that view is your overall growth curve, not a per-tag comparison, so there's no
   * old-volume-vs-one-tag distortion to correct for there.
   */
  renderRatingHistogram(root) {
    if (!root) return;
    const tagFilter = this._histogramTag;
    const allMatching = Store.data.solvedLog.filter((p) => p.rating != null && (tagFilter === "all" || (p.tags || []).includes(tagFilter)));
    const tagOptions = this.histogramTagOptions();

    const selectHtml = `
      <div class="sync-actions">
        <label class="card-subtitle" for="cf-histogram-tag-select" style="margin:0">Filter by tag:</label>
        <select id="cf-histogram-tag-select" class="compare-handle-input">
          <option value="all" ${tagFilter === "all" ? "selected" : ""}>All tags</option>
          ${tagOptions.map((t) => `<option value="${escapeHtml(t)}" ${t === tagFilter ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}
        </select>
      </div>
    `;

    if (!allMatching.length) {
      const emptyMsg =
        tagFilter === "all" ? "Sync your Codeforces handle above to see this." : `No rated solves tagged "${escapeHtml(tagFilter)}" yet.`;
      root.innerHTML = `${selectHtml}<p class="empty-note">${emptyMsg}</p>`;
      this.wireHistogramSelect(root);
      return;
    }

    const totalCount = allMatching.length;
    const solved =
      tagFilter !== "all" && totalCount > this.TAG_RATING_RECENT_WINDOW
        ? [...allMatching].sort((a, b) => (a.solvedDate < b.solvedDate ? 1 : -1)).slice(0, this.TAG_RATING_RECENT_WINDOW)
        : allMatching;

    const counts = {};
    for (const p of solved) {
      const bucket = Math.floor(p.rating / 100) * 100;
      counts[bucket] = (counts[bucket] || 0) + 1;
    }
    const seenBuckets = Object.keys(counts).map(Number);
    const minBucket = Math.min(...seenBuckets);
    const maxBucket = Math.max(...seenBuckets);
    const allBuckets = [];
    for (let b = minBucket; b <= maxBucket; b += 100) allBuckets.push(b);
    const maxCount = Math.max(...allBuckets.map((b) => counts[b] || 0));

    // The topic rating: this filtered set's rating-weighted, cluster-boosted average problem
    // rating (see clusterWeightedAvgRating above) when filtered to one tag — the same "how strong
    // am I here" number the Team Analyzer computes per tag (see js/cf-team-analysis.js
    // topicRatings), not just a raw solve count or a plain mean. "All tags" keeps the plain
    // weightedAvgRating instead, since clustering isn't a meaningful concept across unrelated
    // tags. Flagged as low-confidence under a small sample rather than hidden outright, so
    // switching to a rarely-touched tag doesn't look broken.
    const ratingsForAvg = solved.map((p) => p.rating);
    const avgRating = Math.round(tagFilter === "all" ? this.weightedAvgRating(ratingsForAvg) : this.clusterWeightedAvgRating(ratingsForAvg));
    const lowSample = solved.length < this.TAG_RATING_LOW_CONFIDENCE_SAMPLE;
    const windowed = solved.length < totalCount;
    const ratingStatsHtml = `
      <div class="report-windows cf-totals">
        <div class="stat-tile"><div class="stat-value">${avgRating}</div><div class="stat-label">${tagFilter === "all" ? "avg. rating" : `Topic Wise Rating: "${escapeHtml(tagFilter)}"`}${lowSample ? " &#9888;" : ""}</div></div>
        <div class="stat-tile"><div class="stat-value">${solved.length}</div><div class="stat-label">${windowed ? `recent solves (of ${totalCount})` : `rated solve${solved.length === 1 ? "" : "s"}`}</div></div>
      </div>
    `;

    root.innerHTML = `
      ${selectHtml}
      ${ratingStatsHtml}
      <div class="rating-histogram-row">
        <div class="rating-histogram-axis">
          <span>${maxCount}</span>
          <span>${Math.round(maxCount / 2)}</span>
          <span>0</span>
        </div>
        <div class="rating-histogram-body">
          <div class="rating-histogram-bars">
            ${allBuckets
              .map((b) => {
                const count = counts[b] || 0;
                const pct = maxCount ? (count / maxCount) * 100 : 0;
                return `<div class="rating-histogram-bar-wrap" title="${b}: ${count} solved"><div class="rating-histogram-bar" style="height:${pct}%;background:${this.ratingColor(b)}"></div></div>`;
              })
              .join("")}
          </div>
          <div class="rating-histogram-labels">${allBuckets.map((b) => `<span>${b}</span>`).join("")}</div>
        </div>
      </div>
      <p class="card-subtitle">
        ${windowed ? `Based on your most recent ${solved.length} of ${totalCount} rated solves` : `Based on all ${solved.length} rated solve${solved.length === 1 ? "" : "s"}`}${tagFilter === "all" ? "" : ` tagged "${escapeHtml(tagFilter)}"`}.
        ${lowSample ? `&#9888; Solve more${tagFilter === "all" ? "" : " in this tag"} for a steadier number.` : ""}
      </p>
    `;
    this.wireHistogramSelect(root);
  },

  wireHistogramSelect(root) {
    const select = root.querySelector("#cf-histogram-tag-select");
    if (!select) return;
    select.addEventListener("change", () => {
      this._histogramTag = select.value;
      this.renderRatingHistogram(root);
    });
  },

  renderUnsolved(root) {
    const list = Store.data.cf.unsolvedAttempted;
    if (!list.length) {
      root.innerHTML = `<p class="empty-note">Sync your Codeforces handle above to see problems you've tried but haven't solved yet.</p>`;
      return;
    }
    root.innerHTML = list
      .slice(0, 20)
      .map((p) => {
        const date = new Date(p.lastAttemptDate).toLocaleDateString();
        const ratingLabel = p.rating ? p.rating : "unrated";
        const tagsLabel = (p.tags || []).slice(0, 4).join(", ");
        return `
          <div class="solved-row">
            <span class="solved-key">${escapeHtml(p.contestId && p.index ? `${p.contestId}${p.index}` : p.key)}</span>
            <span class="solved-name">${escapeHtml(p.name)}</span>
            <span class="solved-rating">${escapeHtml(ratingLabel)}</span>
            <span class="solved-tags">${escapeHtml(tagsLabel)}</span>
            <span class="solved-date">${date}</span>
            <span class="solved-rating">${escapeHtml(p.attemptCount)} attempt${p.attemptCount === 1 ? "" : "s"}</span>
          </div>`;
      })
      .join("");
  },
};
