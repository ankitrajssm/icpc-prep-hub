/** Codeforces page: sync, solved log, reports, and the new analysis card. */
(function () {
  function todayISODate() {
    return new Date().toISOString().slice(0, 10);
  }

  function parseTags(text) {
    return text
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }

  function setSyncStatus(msg, kind) {
    const el = $("sync-status");
    el.textContent = msg;
    el.className = `sync-status ${kind || ""}`;
  }

  /** "+N pts" (points only sync once verified, so a gate above this already stops the 0-point case). */
  function ptsLabel(pointsGained) {
    return `+${pointsGained} pts`;
  }

  /**
   * Sync is fully locked behind Codeforces verification (see applyLockState below) — an unproven
   * handle can no longer populate solved-log/rating/accuracy data at all, so there's nothing left
   * to explain here beyond confirming who you're synced as once verified.
   */
  function renderVerifyBadge() {
    const el = $("cf-verify-status-badge");
    if (!el) return;
    const { cfHandle } = Store.data.profile;
    el.innerHTML = `<span class="verified-note">&check; Syncing as verified handle <strong>${escapeHtml(cfHandle)}</strong>.</span>`;
    el.className = "card-subtitle";
  }

  /**
   * Sync (and everything derived from it — solved log, reports, "Profile analysis" in Codeforces
   * Analysis) is locked behind verification. Previously an unverified handle could still sync and
   * populate every stat on this page (just scoring 0 points), which meant typing in ANY public
   * handle — your own or not — made its solve history render as "yours." Switching to your real
   * handle afterward didn't retroactively unmix that data from what had already synced in. Since
   * "Compare with someone" (Codeforces Analysis) already covers looking up any public handle
   * without claiming it as your own, there's no reason to keep this second, murkier path open.
   */
  function applyLockState() {
    const unlocked = Boolean(Store.data.profile.cfVerified);
    $("cf-locked-card").hidden = unlocked;
    $("sync-card").hidden = !unlocked;
    $("reports-card").hidden = !unlocked;
    return unlocked;
  }

  function refreshDynamic() {
    Nav.updatePointsBadge();
    const unlocked = applyLockState();
    CFAnalysis.render($("cf-analysis-root"));
    if (!unlocked) return;
    renderVerifyBadge();
    SolvedLogUI.render($("solved-log-root"));
    Reports.render($("reports-root"));
  }

  async function handleSyncNow() {
    if (!Store.data.profile.cfVerified) return; // sync-card is hidden until verified; belt and suspenders
    const handle = Store.data.profile.cfHandle.trim();
    if (!handle) {
      setSyncStatus("Set your Codeforces handle on the Dashboard first.", "error");
      return;
    }
    setSyncStatus("Fetching…", "");
    const result = await CFSync.fetchLive(handle);
    if (!result.ok) {
      setSyncStatus(`Live fetch failed (${result.error}). Use the manual fallback below.`, "error");
      $("manual-sync-details").open = true;
      return;
    }
    const { added, pointsGained } = CFSync.applyProblems(result.problems);
    CFSync.applyAnalysis(result);
    setSyncStatus(`Synced. ${added} new solve${added === 1 ? "" : "s"} added (${ptsLabel(pointsGained)}). Fetching Codeforces Rating history…`, "success");
    refreshDynamic();

    const ratingResult = await CFSync.fetchRatingHistory(handle);
    if (ratingResult.ok) {
      CFSync.applyRatingHistory(ratingResult.history);
      setSyncStatus(`Synced. ${added} new solve${added === 1 ? "" : "s"} added (${ptsLabel(pointsGained)}).`, "success");
      refreshDynamic();
    } else {
      setSyncStatus(`Synced (${ptsLabel(pointsGained)}), but Codeforces Rating history failed: ${ratingResult.error}.`, "success");
    }
  }

  function handleManualSync() {
    if (!Store.data.profile.cfVerified) return; // sync-card is hidden until verified; belt and suspenders
    const text = $("manual-json-input").value.trim();
    if (!text) {
      setSyncStatus("Paste the JSON response first.", "error");
      return;
    }
    try {
      const result = CFSync.parseManual(text);
      const { added, pointsGained } = CFSync.applyProblems(result.problems);
      CFSync.applyAnalysis(result);
      setSyncStatus(`Synced from pasted JSON. ${added} new solve${added === 1 ? "" : "s"} added (${ptsLabel(pointsGained)}).`, "success");
      $("manual-json-input").value = "";
      refreshDynamic();
    } catch (e) {
      setSyncStatus(`Couldn't parse that JSON: ${e.message}`, "error");
    }
  }

  function handleManualLog(evt) {
    evt.preventDefault();
    if (!Store.data.profile.cfVerified) return; // sync-card is hidden until verified; belt and suspenders
    const contestId = $("log-contest-id").value.trim();
    const index = $("log-index").value.trim();
    const name = $("log-name").value.trim();
    const rating = $("log-rating").value ? Number($("log-rating").value) : null;
    const tags = parseTags($("log-tags").value);
    const solvedDate = $("log-date").value ? new Date($("log-date").value).toISOString() : new Date().toISOString();

    if (!name && !(contestId && index)) {
      setSyncStatus("Give the solve a name or a contest ID + index.", "error");
      return;
    }

    const { added, pointsGained } = CFSync.logSingle({ contestId, index, name, rating, tags, solvedDate });
    setSyncStatus(added ? `Logged (${ptsLabel(pointsGained)}).` : "That problem is already logged.", added ? "success" : "");
    evt.target.reset();
    $("log-date").value = todayISODate();
    refreshDynamic();
  }

  function wireSyncCard() {
    $("sync-now-btn").addEventListener("click", handleSyncNow);
    $("manual-sync-btn").addEventListener("click", handleManualSync);
    $("manual-log-form").addEventListener("submit", handleManualLog);
    $("log-date").value = todayISODate();
    $("manual-api-link").href = Store.data.profile.cfHandle ? CFSync.apiUrl(Store.data.profile.cfHandle) : "#";
  }

  // wireSyncCard() attaches listeners to static markup that's only ever parsed once — must run
  // exactly once, whether "ready" first becomes true on the initial DOMContentLoaded (already
  // signed in when the page loads) or later via icpc:external-data-change (sign in happens after
  // page load, through AuthUI). This flag makes it safe to call from both places.
  let wired = false;
  function wireOnce() {
    if (wired) return;
    wired = true;
    wireSyncCard();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await Shell.ready;
    if (!Auth.isSignedIn() || !Store.isLoaded()) return;
    wireOnce();
    refreshDynamic();
  });

  // Sign-in/out, another device syncing, a focus-triggered refetch — see storage.js/shell.js.
  document.addEventListener("icpc:external-data-change", () => {
    if (!Auth.isSignedIn() || !Store.isLoaded()) return;
    wireOnce();
    $("manual-api-link").href = Store.data.profile.cfHandle ? CFSync.apiUrl(Store.data.profile.cfHandle) : "#";
    refreshDynamic();
  });
})();
