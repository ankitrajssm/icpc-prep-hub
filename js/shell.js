/**
 * Shared bootstrap — runs on every page, owns whatever must behave identically no matter which
 * page loaded first: nav, theme, and the sign-in / account-data boot sequence.
 *
 * Three states a gated page can be in: not signed in -> signed in but no verified Codeforces
 * handle yet -> both done. Home (index.html) and Team (team.html) are exempt from the hard gate —
 * Home already degrades to a friendly zero-state when signed out, and Team Analyzer is explicitly
 * ephemeral/never-persisted, unrelated to accounts (see js/pages/team.js). The other 4 pages each
 * have an #auth-gate + #page-body pair in their HTML; the "verified handle" sub-state is each of
 * those pages' own existing locked-card pattern (#cf-locked-card etc. in js/pages/*.js), untouched
 * by this file.
 */
const Shell = {
  ready: null,

  init() {
    Nav.render(location.pathname);
    Theme.init(); // Store-independent — safe to run before any network call, avoids a theme flash
    this.ready = this._boot();
  },

  _isOptionalPage() {
    const page = Nav.currentPage(location.pathname);
    return page === "index.html" || page === "team.html" || page === "";
  },

  async _boot() {
    await Auth.ready;
    
    if (Auth.isConfigured()) {
      Auth.client.rpc('increment_page_view', { 
        is_authorized: Auth.isSignedIn()
      }).then(({ error }) => {
        if (error) console.error('Failed to track page view:', error);
      });
    }

    Nav.updateAccountArea();
    const gate = $("auth-gate");
    const body = $("page-body");
    const optional = this._isOptionalPage();

    if (!Auth.isSignedIn()) {
      Store.clear();
      if (gate && !optional) AuthUI.mount(gate);
      if (body) body.hidden = true;
      Nav.updatePointsBadge();
      return;
    }

    if (gate) AuthUI.unmount(gate);

    const result = await Store.load();
    if (!result.ok) {
      this._showLoadError(result.error);
      return;
    }
    if (body) body.hidden = false;
    Nav.updatePointsBadge();
  },

  _showLoadError(error) {
    const gate = $("auth-gate");
    if (!gate) return;
    gate.hidden = false;
    gate.innerHTML = `
      <div class="login-gate">
        <div class="login-card">
          <h1 class="login-title">Couldn't load your data</h1>
          <p class="login-subtitle">${escapeHtml(error)}</p>
          <button type="button" id="shell-retry-btn" class="btn-primary login-submit">Retry</button>
        </div>
      </div>
    `;
    $("shell-retry-btn").addEventListener("click", () => {
      Shell.ready = Shell._rebootAndNotify();
    });
  },

  /**
   * Re-runs the boot sequence and tells every already-rendered (or already-bailed-on-a-failed-
   * load) page to re-check state — used after a retry and after any sign-in/out transition, both
   * of which happen *after* a page's own DOMContentLoaded has already run once and either rendered
   * or returned early. Reassigning Shell.ready alone wouldn't reach code that already resumed from
   * the OLD promise; this event is what actually gets pages to look again.
   */
  async _rebootAndNotify() {
    await this._boot();
    document.dispatchEvent(new CustomEvent("icpc:external-data-change"));
  },
};

document.addEventListener("DOMContentLoaded", () => Shell.init());

document.addEventListener("icpc:auth-changed", () => {
  Shell.ready = Shell._rebootAndNotify();
});
