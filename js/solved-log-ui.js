/**
 * Recent-solves list. Shared by the Dashboard's short teaser and the full
 * Codeforces-page list via the `limit` option.
 */
const SolvedLogUI = {
  render(root, { limit = 12 } = {}) {
    if (!root) return;
    const log = Store.data.solvedLog.slice().sort((a, b) => (a.solvedDate < b.solvedDate ? 1 : -1));
    const recent = log.slice(0, limit);
    if (!recent.length) {
      root.innerHTML = `<p class="empty-note">No solves logged yet. Sync with Codeforces or log one manually.</p>`;
      return;
    }
    root.innerHTML = recent
      .map((p) => {
        const date = new Date(p.solvedDate).toLocaleDateString();
        const ratingLabel = p.rating ? p.rating : "unrated";
        const tagsLabel = (p.tags || []).slice(0, 4).join(", ");
        return `
          <div class="solved-row">
            <span class="solved-key">${escapeHtml(p.contestId && p.index ? `${p.contestId}${p.index}` : p.key)}</span>
            <span class="solved-name">${escapeHtml(p.name)}</span>
            <span class="solved-rating">${escapeHtml(ratingLabel)}</span>
            <span class="solved-tags">${escapeHtml(tagsLabel)}</span>
            <span class="solved-date">${date}</span>
            <span class="solved-points">+${escapeHtml(p.points)}</span>
            <span class="solved-source badge-${escapeHtml(p.source)}">${p.source === "cf-sync" ? "CF sync" : "manual"}</span>
          </div>`;
      })
      .join("");
  },
};
