/** Dashboard page: verify your Codeforces handle, preferences, timeline, roadmap summary, recent solves, backup. */
(function () {
  let verifyState = null; // { handle, problem, startedAtMs } while a verification is in progress

  function refreshDynamic() {
    Nav.updatePointsBadge();
    Timeline.render($("timeline-root"));
    Gamification.renderStreak($("streak-root"));
    Roadmap.renderSummary($("roadmap-summary-root"));
    SolvedLogUI.render($("solved-log-root"), { limit: 5 });
  }

  // --- Verified view: preferences ---

  function renderVerifiedView() {
    const p = Store.data.profile;
    $("verified-handle").textContent = p.cfHandle;
    $("gamification-start-date").textContent = p.gamificationStart ? new Date(p.gamificationStart).toLocaleDateString() : "today";
    $("focus-tags-input").value = (p.focusTags && p.focusTags[0]) || "";
    $("target-date-input").value = p.targetDate || "";
  }

  function wirePrefsForm() {
    $("prefs-form").addEventListener("submit", (evt) => {
      evt.preventDefault();
      Store.update((d) => {
        const chosenTag = $("focus-tags-input").value;
        d.profile.focusTags = chosenTag ? [chosenTag] : [];
        d.profile.targetDate = $("target-date-input").value || null;
      });
      const note = $("prefs-saved-note");
      note.hidden = false;
      setTimeout(() => (note.hidden = true), 1800);
      refreshDynamic();
    });
  }

  // --- Unverified view: verify your Codeforces handle ---

  function wireVerifyStartForm() {
    $("cf-verify-start-form").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const handle = $("cf-handle-input").value.trim();
      if (!handle) return;
      verifyState = { handle, problem: CFVerify.pickProblem(), startedAtMs: Date.now() };
      renderAuthState();
    });
  }

  async function completeVerify(handle) {
    const statusEl = $("verify-status");
    const result = await Store.verifyHandle(handle);
    if (!result.ok) {
      statusEl.textContent = `Couldn't verify (${result.error}).`;
      statusEl.className = "sync-status error";
      // Re-enable whichever button triggered this (checkLive or the manual-JSON fallback) — a
      // real, expected failure here (e.g. the handle's already verified on another account, via
      // the DB uniqueness constraint) shouldn't leave the user stuck with no way to retry short of
      // cancelling and restarting the whole compile-error-submission flow from scratch.
      const checkBtn = $("check-verify-btn");
      const manualBtn = $("verify-manual-btn");
      if (checkBtn) checkBtn.disabled = false;
      if (manualBtn) manualBtn.disabled = false;
      return;
    }
    verifyState = null;
    renderAuthState();
    refreshDynamic();
  }

  function renderVerifySection() {
    const root = $("cf-verify-section");
    if (!root) return;
    if (!verifyState) {
      root.innerHTML = "";
      return;
    }

    const { handle, problem } = verifyState;
    root.innerHTML = `
      <p>1. Open the <a href="${CFVerify.problemUrl(problem)}" target="_blank" rel="noopener noreferrer">submit page for ${escapeHtml(problem.name)} (${problem.contestId}${problem.index})</a> — it pre-selects the problem, no searching needed.</p>
      <p>2. Submit ANY code that fails to compile (e.g. delete a semicolon) as <strong>${escapeHtml(handle)}</strong>, within the next ${CFVerify.WINDOW_MINUTES} minutes.</p>
      <div class="form-actions">
        <button id="check-verify-btn" type="button" class="btn-primary">I submitted it — check now</button>
        <button id="cancel-verify-btn" type="button" class="btn-icon">Cancel</button>
      </div>
      <span id="verify-status" class="sync-status"></span>
      <details>
        <summary>Manual fallback (paste JSON)</summary>
        <p><a href="${CFSync.apiUrl(handle)}" target="_blank" rel="noopener noreferrer">Open Codeforces API URL →</a></p>
        <textarea id="verify-manual-json" rows="5" placeholder="Paste the JSON response here"></textarea>
        <button id="verify-manual-btn" type="button" class="btn-secondary">Check pasted JSON</button>
      </details>
    `;

    $("check-verify-btn").addEventListener("click", async (evt) => {
      const btn = evt.currentTarget;
      const statusEl = $("verify-status");
      btn.disabled = true; // guards a rapid double-click firing two checks (and possibly two verifyHandle writes)
      statusEl.textContent = "Checking…";
      statusEl.className = "sync-status";
      const result = await CFVerify.checkLive(handle, problem, verifyState.startedAtMs);
      if (!result.ok) {
        btn.disabled = false;
        statusEl.textContent = `Live check failed (${result.error}). Use the manual fallback below.`;
        statusEl.className = "sync-status error";
        return;
      }
      if (result.verified) {
        statusEl.textContent = "Verified! Linking your account…";
        statusEl.className = "sync-status";
        await completeVerify(handle);
      } else {
        btn.disabled = false;
        statusEl.textContent = "No matching compile-error submission found yet. Submit it, then try again.";
        statusEl.className = "sync-status error";
      }
    });

    $("cancel-verify-btn").addEventListener("click", () => {
      verifyState = null;
      renderAuthState();
    });

    $("verify-manual-btn").addEventListener("click", async (evt) => {
      const btn = evt.currentTarget;
      const text = $("verify-manual-json").value.trim();
      const statusEl = $("verify-status");
      btn.disabled = true;
      try {
        const ok = CFVerify.checkManual(text, handle, problem, verifyState.startedAtMs);
        if (ok) {
          statusEl.textContent = "Verified! Linking your account…";
          statusEl.className = "sync-status";
          await completeVerify(handle);
        } else {
          btn.disabled = false;
          statusEl.textContent = "No matching compile-error submission found in that JSON.";
          statusEl.className = "sync-status error";
        }
      } catch (e) {
        btn.disabled = false;
        statusEl.textContent = `Couldn't parse that JSON: ${e.message}`;
        statusEl.className = "sync-status error";
      }
    });
  }

  /** Toggle between the "verify your handle" card and the full dashboard content — both live
   * inside #page-body, which js/shell.js already gates on being signed in. */
  function renderAuthState() {
    const verified = Boolean(Store.data.profile.cfVerified);
    $("cf-verify-card").hidden = verified;
    $("dashboard-content").hidden = !verified;
    if (verified) {
      $("cf-verify-section").innerHTML = "";
      renderVerifiedView();
      return;
    }
    $("cf-verify-start-form").hidden = Boolean(verifyState);
    if (!verifyState) $("cf-handle-input").value = "";
    renderVerifySection();
  }

  function downloadExport() {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `icpc-prep-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function wireDataCard() {
    const actionsDefault = $("data-actions-default");
    const confirmZone = $("data-confirm-zone");
    const fileInput = $("import-file-input");
    const status = $("data-status");

    function closeConfirm() {
      confirmZone.hidden = true;
      confirmZone.innerHTML = "";
      actionsDefault.hidden = false;
    }

    // Reset wipes everything and Import silently overwrites everything with the picked file's
    // contents, but previously only Reset had any confirmation (a bare native confirm(), easy to
    // click through on muscle memory) and Import had none. This renders a warning + an "export a
    // backup first" escape hatch + a confirm/cancel pair in place of the normal buttons instead.
    function showConfirm(message, onConfirm) {
      actionsDefault.hidden = true;
      confirmZone.hidden = false;
      confirmZone.innerHTML = `
        <p>&#9888; ${escapeHtml(message)}</p>
        <div class="form-actions">
          <button type="button" id="data-confirm-export-first" class="btn-secondary">Export a backup first</button>
          <button type="button" id="data-confirm-yes" class="btn-danger">Yes, I'm sure</button>
          <button type="button" id="data-confirm-cancel" class="btn-icon">Cancel</button>
        </div>
      `;
      $("data-confirm-export-first").addEventListener("click", downloadExport);
      $("data-confirm-yes").addEventListener("click", async () => {
        closeConfirm();
        await onConfirm();
      });
      $("data-confirm-cancel").addEventListener("click", () => {
        closeConfirm();
        fileInput.value = ""; // no-op if this confirm wasn't triggered by a file pick
      });
    }

    $("export-btn").addEventListener("click", downloadExport);

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      showConfirm(
        `This will REPLACE all of your current roadmap progress, points, logs, and rewards with the contents of "${file.name}". Your verified Codeforces handle stays linked either way. This can't be undone.`,
        async () => {
          const text = await file.text();
          status.textContent = "Importing…";
          status.className = "sync-status";
          const result = await Store.importJSON(text);
          if (result.ok) {
            status.textContent = "Import successful.";
            status.className = "sync-status success";
            renderAuthState();
            refreshDynamic();
          } else {
            status.textContent = `Import failed: ${result.error}`;
            status.className = "sync-status error";
          }
          fileInput.value = "";
        }
      );
    });

    $("reset-btn").addEventListener("click", () => {
      showConfirm(
        "This clears your roadmap progress, points, logs, and rewards. Your verified Codeforces handle stays linked. This can't be undone.",
        async () => {
          status.textContent = "Resetting…";
          status.className = "sync-status";
          const result = await Store.resetAll();
          if (result.ok) {
            renderAuthState();
            refreshDynamic();
            status.textContent = "Progress reset.";
            status.className = "sync-status success";
          } else {
            status.textContent = `Reset failed: ${result.error}`;
            status.className = "sync-status error";
          }
        }
      );
    });
  }

  function isReady() {
    return Auth.isSignedIn() && Store.isLoaded();
  }

  // #page-body's forms are static markup wired once and never re-created — but "ready" can first
  // become true either on the initial DOMContentLoaded (the common case: already signed in when
  // the page loads) OR later, on icpc:external-data-change (sign in happens *after* page load, via
  // AuthUI mounted in the separate #auth-gate area). This flag makes wiring idempotent across
  // either path, so the forms get attached exactly once whichever one fires first.
  let wired = false;
  function wireOnce() {
    if (wired) return;
    wired = true;
    wireVerifyStartForm();
    wirePrefsForm();
    wireDataCard();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await Shell.ready;
    if (!isReady()) return;
    wireOnce();
    renderAuthState();
    refreshDynamic();
  });

  document.addEventListener("icpc:points-changed", () => {
    if (!isReady()) return;
    Nav.updatePointsBadge();
    Gamification.renderStreak($("streak-root"));
  });

  // Sign-in/out elsewhere, another tab/device syncing, a focus-triggered refetch — see storage.js
  // and shell.js. wireOnce() is a no-op if DOMContentLoaded already wired the forms (the common
  // case); it's what actually wires them the first time if sign-in happens after page load.
  document.addEventListener("icpc:external-data-change", () => {
    if (!isReady()) return;
    wireOnce();
    verifyState = null;
    renderAuthState();
    refreshDynamic();
  });
})();
