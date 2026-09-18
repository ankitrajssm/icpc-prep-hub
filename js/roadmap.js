/**
 * Roadmap rendering + progress calculations. Topics with a curated practice-problem set (see
 * js/roadmap-problems-data.js) auto-complete once every one of their problems shows up in the
 * user's solved log — completion is derived live from solved history, never stored, so it can
 * never drift out of sync with what's actually been solved. Topics with no practice-problem
 * entry (currently all of Contest Meta-Skills — process/mindset skills like team coordination or
 * post-contest review that no problem set can substitute for) fall back to the old manually-
 * toggled checkbox, stored in Store.data.roadmapProgress.
 */
const HIT_SCORE_META = {
  5: { label: "Essential", className: "hit-score-5" },
  4: { label: "High Priority", className: "hit-score-4" },
  3: { label: "Useful", className: "hit-score-3" },
  2: { label: "Situational", className: "hit-score-2" },
  1: { label: "Rare", className: "hit-score-1" },
};

const Roadmap = {
  allTopics() {
    const out = [];
    for (const subject of ROADMAP) {
      for (const phase of subject.phases) {
        for (const topic of phase.topics) {
          out.push({ ...topic, subjectId: subject.id, subjectName: subject.name, phase: phase.name });
        }
      }
    }
    return out;
  },

  /** True if this topic has a curated practice-problem set (see js/roadmap-problems-data.js). */
  hasPracticeProblems(topicId) {
    const list = ROADMAP_PROBLEMS[topicId];
    return Array.isArray(list) && list.length > 0;
  },

  /** Keys of every problem in the user's solved log, for O(1) per-problem lookups below. */
  solvedKeySet() {
    return new Set(Store.data.solvedLog.map((p) => p.key));
  },

  /** { problems: [...each with a .solved flag], solvedCount, total, done } for one practice-problem topic. */
  practiceStatus(topicId) {
    const list = ROADMAP_PROBLEMS[topicId] || [];
    const solvedKeys = this.solvedKeySet();
    const problems = list.map((p) => ({ ...p, solved: solvedKeys.has(Gamification.problemKey(p.contestId, p.index)) }));
    const solvedCount = problems.filter((p) => p.solved).length;
    return { problems, solvedCount, total: problems.length, done: problems.length > 0 && solvedCount === problems.length };
  },

  /**
   * A topic with curated practice problems is done once every one of them is solved. A topic
   * with no practice-problem entry falls back to the old manually-toggled flag — see file header.
   */
  isDone(topicId) {
    if (this.hasPracticeProblems(topicId)) return this.practiceStatus(topicId).done;
    return !!Store.data.roadmapProgress[topicId];
  },

  /** Manual toggle — only meaningful, and only exposed in the UI, for topics with no practice-problem entry. */
  setDone(topicId, done) {
    Store.update((d) => {
      if (done) d.roadmapProgress[topicId] = true;
      else delete d.roadmapProgress[topicId];
    });
  },

  subjectProgress(subject) {
    const topics = subject.phases.flatMap((p) => p.topics);
    const done = topics.filter((t) => this.isDone(t.id)).length;
    return { done, total: topics.length, percent: topics.length ? Math.round((done / topics.length) * 100) : 0 };
  },

  overallProgress() {
    const topics = this.allTopics();
    const done = topics.filter((t) => this.isDone(t.id)).length;
    return { done, total: topics.length, percent: topics.length ? Math.round((done / topics.length) * 100) : 0 };
  },

  /** Total curated practice problems solved across every topic that has a practice-problem set (Contest Meta-Skills excluded). */
  totalPracticeProgress() {
    const solvedKeys = this.solvedKeySet();
    let solved = 0;
    let total = 0;
    for (const list of Object.values(ROADMAP_PROBLEMS)) {
      total += list.length;
      solved += list.filter((p) => solvedKeys.has(Gamification.problemKey(p.contestId, p.index))).length;
    }
    return { solved, total, percent: total ? Math.round((solved / total) * 100) : 0 };
  },

  /** Group all topics (across every subject) by phase name, in Foundations -> Core -> Advanced order. */
  phaseBuckets() {
    const order = ["Foundations", "Core", "Advanced"];
    const buckets = order.map((name) => ({ phase: name, topics: [] }));
    for (const t of this.allTopics()) {
      const bucket = buckets.find((b) => b.phase === t.phase);
      if (bucket) bucket.topics.push(t);
      else buckets.push({ phase: t.phase, topics: [t] });
    }
    return buckets.map((b) => {
      const done = b.topics.filter((t) => this.isDone(t.id)).length;
      return { ...b, done, total: b.topics.length, percent: b.topics.length ? Math.round((done / b.topics.length) * 100) : 0 };
    });
  },

  /** Compact overall-progress + per-phase summary for the Dashboard, with a link to the full checklist. */
  renderSummary(container) {
    if (!container) return;
    const overall = this.overallProgress();
    const practice = this.totalPracticeProgress();
    const buckets = this.phaseBuckets();
    container.innerHTML = `
      <div class="progress-row">
        <div class="progress-bar"><div class="progress-fill" style="width:${overall.percent}%"></div></div>
        <span class="progress-label">${overall.done} / ${overall.total} topics (${overall.percent}%)</span>
      </div>
      <div class="progress-row">
        <div class="progress-bar"><div class="progress-fill progress-fill-secondary" style="width:${practice.percent}%"></div></div>
        <span class="progress-label">${practice.solved} / ${practice.total} practice problems solved (${practice.percent}%)</span>
      </div>
      <div class="report-windows">
        ${buckets
          .map(
            (b) => `
          <div class="stat-tile">
            <div class="stat-value">${b.percent}%</div>
            <div class="stat-label">${escapeHtml(b.phase)} (${b.done}/${b.total})</div>
          </div>`
          )
          .join("")}
      </div>
      <p class="card-subtitle"><a href="roadmap.html">View full roadmap &rarr;</a></p>
    `;
  },

  /** id of the subject currently shown in the detail pane; persists across re-renders within a page view. */
  _selectedSubjectId: null,

  /** ids of topics whose practice-problem panel is currently expanded; persists across re-renders within a page view. */
  _expandedTopics: new Set(),

  render(container) {
    container.innerHTML = "";

    const overall = this.overallProgress();
    const practice = this.totalPracticeProgress();
    const summary = document.createElement("div");
    summary.className = "roadmap-summary";
    summary.innerHTML = `
      <div class="progress-row">
        <div class="progress-bar"><div class="progress-fill" style="width:${overall.percent}%"></div></div>
        <span class="progress-label">${overall.done} / ${overall.total} topics (${overall.percent}%)</span>
      </div>
      <div class="progress-row">
        <div class="progress-bar"><div class="progress-fill progress-fill-secondary" style="width:${practice.percent}%"></div></div>
        <span class="progress-label">${practice.solved} / ${practice.total} practice problems solved (${practice.percent}%)</span>
      </div>
    `;
    container.appendChild(summary);

    if (!this._selectedSubjectId || !ROADMAP.some((s) => s.id === this._selectedSubjectId)) {
      this._selectedSubjectId = ROADMAP[0].id;
    }

    const layout = document.createElement("div");
    layout.className = "roadmap-layout";
    container.appendChild(layout);

    const nav = document.createElement("nav");
    nav.className = "subject-nav";
    nav.setAttribute("aria-label", "Subjects");
    layout.appendChild(nav);

    ROADMAP.forEach((subject) => {
      const sp = this.subjectProgress(subject);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "subject-nav-item" + (subject.id === this._selectedSubjectId ? " active" : "");
      btn.innerHTML = `
        <span class="subject-nav-top">
          <span class="subject-nav-name">${escapeHtml(subject.name)}</span>
          <span class="subject-nav-count">${sp.done}/${sp.total}</span>
        </span>
        <div class="progress-bar subject-nav-bar"><div class="progress-fill" style="width:${sp.percent}%"></div></div>
      `;
      btn.addEventListener("click", () => {
        this._selectedSubjectId = subject.id;
        this.render(container);
      });
      nav.appendChild(btn);
    });

    const subject = ROADMAP.find((s) => s.id === this._selectedSubjectId);
    const detail = document.createElement("div");
    detail.className = "card subject-detail";
    layout.appendChild(detail);

    const heading = document.createElement("h3");
    heading.className = "subject-detail-title";
    heading.textContent = subject.name;
    detail.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.className = "subject-blurb";
    blurb.textContent = subject.blurb;
    detail.appendChild(blurb);

    for (const phase of subject.phases) {
      const phaseEl = document.createElement("div");
      phaseEl.className = "phase-block";
      const phaseHeading = document.createElement("h4");
      phaseHeading.textContent = phase.name;
      phaseEl.appendChild(phaseHeading);

      const list = document.createElement("ul");
      list.className = "topic-list";
      for (const topic of phase.topics) {
        list.appendChild(this.renderTopicItem(topic, container));
      }
      phaseEl.appendChild(list);
      detail.appendChild(phaseEl);
    }
  },

  /** Shared text block (name + hit-score badge + what/why/resource) reused by both topic-item variants below. */
  buildTopicTextEl(topic) {
    const textWrap = document.createElement("span");
    textWrap.className = "topic-text";
    const nameEl = document.createElement("span");
    nameEl.className = "topic-name";
    nameEl.textContent = topic.name;
    const scoreMeta = HIT_SCORE_META[topic.hitScore];
    if (scoreMeta) {
      const scoreEl = document.createElement("span");
      scoreEl.className = `hit-score ${scoreMeta.className}`;
      scoreEl.textContent = scoreMeta.label;
      scoreEl.title = "How important this topic is for ICPC, based on how often it's a prerequisite for other topics and how often it appears in regionals/World Finals directly.";
      nameEl.appendChild(scoreEl);
    }
    textWrap.appendChild(nameEl);

    if (topic.what) {
      const whatEl = document.createElement("span");
      whatEl.className = "topic-what";
      whatEl.textContent = topic.what;
      textWrap.appendChild(whatEl);
    }

    const whyEl = document.createElement("span");
    whyEl.className = "topic-why";
    whyEl.textContent = topic.why;
    textWrap.appendChild(whyEl);

    if (topic.resource) {
      const link = document.createElement("a");
      link.className = "topic-resource";
      link.href = topic.resource.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `→ ${topic.resource.label}`;
      textWrap.appendChild(link);
    }
    return textWrap;
  },

  /**
   * One <li> for a topic. Two variants depending on hasPracticeProblems: the original manual
   * checkbox (meta-skill topics only now), or a read-only status dot + a "Practice questions"
   * toggle that expands the curated problem list with live solved/unsolved status.
   */
  renderTopicItem(topic, container) {
    const li = document.createElement("li");
    li.className = "topic-item";

    if (!this.hasPracticeProblems(topic.id)) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.isDone(topic.id);
      checkbox.addEventListener("change", () => {
        this.setDone(topic.id, checkbox.checked);
        this.render(container);
        document.dispatchEvent(new CustomEvent("roadmap:changed"));
      });
      label.appendChild(checkbox);
      label.appendChild(this.buildTopicTextEl(topic));
      li.appendChild(label);
      return li;
    }

    const status = this.practiceStatus(topic.id);
    const row = document.createElement("div");
    row.className = "topic-item-row";

    const dot = document.createElement("span");
    dot.className = "topic-status-dot" + (status.done ? " done" : "");
    dot.setAttribute("role", "status");
    dot.setAttribute("aria-label", status.done ? "Completed" : "Not yet completed");
    dot.textContent = status.done ? "✓" : "";
    row.appendChild(dot);

    const textWrap = this.buildTopicTextEl(topic);

    const expanded = this._expandedTopics.has(topic.id);
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn-icon practice-questions-btn";
    toggleBtn.textContent = `${expanded ? "Hide" : "Practice questions"} (${status.solvedCount}/${status.total} solved)`;
    toggleBtn.addEventListener("click", () => {
      if (this._expandedTopics.has(topic.id)) this._expandedTopics.delete(topic.id);
      else this._expandedTopics.add(topic.id);
      this.render(container);
    });
    textWrap.appendChild(toggleBtn);

    if (expanded) {
      textWrap.appendChild(this.buildPracticePanel(status));
    }

    row.appendChild(textWrap);
    li.appendChild(row);
    return li;
  },

  /** The expanded list of a topic's practice problems, each linking out to Codeforces with a live solved/unsolved badge. */
  buildPracticePanel(status) {
    const panel = document.createElement("div");
    panel.className = "practice-questions-panel";

    if (!Store.data.solvedLog.length) {
      const note = document.createElement("p");
      note.className = "card-subtitle";
      note.textContent = "Sync your Codeforces handle on the Codeforces page to have solved problems reflected here automatically.";
      panel.appendChild(note);
    }

    for (const p of status.problems) {
      const row = document.createElement("div");
      row.className = "practice-problem-row" + (p.solved ? " solved" : "");

      const link = document.createElement("a");
      link.className = "practice-problem-name";
      link.href = `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${p.contestId}${p.index} — ${p.name}`;
      row.appendChild(link);

      const rating = document.createElement("span");
      rating.className = "practice-problem-rating";
      rating.textContent = p.rating ? `${p.rating}` : "unrated";
      row.appendChild(rating);

      const badge = document.createElement("span");
      badge.className = "practice-problem-status" + (p.solved ? " solved" : " unsolved");
      badge.textContent = p.solved ? "✓ Solved" : "Not solved yet";
      row.appendChild(badge);

      panel.appendChild(row);
    }
    return panel;
  },
};
