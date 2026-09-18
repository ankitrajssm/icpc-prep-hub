/**
 * Server-backed data store. Everything about you (roadmap progress, points, solved log, rewards,
 * redemptions) lives in this account's `profiles` row in Supabase (see
 * supabase/migrations/20260915023419_initial_schema.sql), one JSONB blob (`app_data`) per signed-in
 * user, RLS-scoped so you can only ever read/write your own row. Nothing about your progress is
 * kept in this browser at rest — js/shell.js awaits Store.load() before any page renders, and every
 * write here goes to the server (see save()/verifyHandle() below), not to localStorage.
 *
 * (Theme is the one deliberate exception — see js/theme.js — a per-device cosmetic preference with
 * no sync/privacy stakes, and syncing it here would create a real chicken-and-egg problem: it needs
 * to apply before any network round-trip, to avoid a flash of the wrong theme on load, including
 * while signed out and before there's any account to attach a preference to.)
 */

function defaultData() {
  return {
    version: 5,
    profile: {
      cfHandle: "",
      cfVerified: false,
      gamificationStart: null, // ISO date string, auto-set the day the CF handle is first verified
      focusTags: [], // at most one tag, chosen from the dropdown
      targetDate: "2026-10-03", // ISO date string, editable
    },
    roadmapProgress: {}, // { [topicId]: true }
    points: {
      balance: 0,
    },
    solvedLog: [
      // { key: "1500A", contestId, index, name, rating, tags: [], solvedDate: ISO, points, source: "cf-sync"|"manual" }
    ],
    cf: {
      ratingHistory: [
        // { contestId, contestName, ratingUpdateTimeSeconds, oldRating, newRating }
      ],
      attemptStats: {
        // { [problemKey]: wrongAttemptCount } — only for problems that are also in solvedLog
      },
      unsolvedAttempted: [
        // { key, contestId, index, name, rating, tags, lastAttemptDate: ISO, attemptCount }
        // capped to the 100 most-recently-attempted, newest first
      ],
      lastRatingSyncAt: null, // ISO timestamp, informational only
    },
    rewards: [
      { id: "r-youtube", name: "15-minute YouTube break", cost: 15, locked: true },
      { id: "r-treat", name: "A small treat / snack", cost: 20, locked: true },
      { id: "r-afternoon", name: "A guilt-free lazy afternoon", cost: 75, locked: true },
    ],
    redemptions: [
      // { id, rewardId, rewardName, cost, date }
    ],
  };
}

/**
 * Coerce a value back to a finite number, or `fallback` if it isn't one — closes a real stored-XSS
 * hole. `deepMerge` only checks that an incoming ARRAY is an array and an incoming OBJECT is an
 * object; it never checks an individual field's type. Several render functions across the app
 * (Recent Solves, the points-overview stat tiles, the rewards list, …) interpolate fields like
 * `solvedLog[].rating/points`, `points.balance`, and `rewards[].cost` directly into `innerHTML`
 * without `escapeHtml`, because under every path the app itself writes through (CF sync, the
 * manual-log form, redeeming a reward) those fields are always genuinely numbers. A hand-edited or
 * malicious "backup" JSON file loaded via Import JSON breaks that assumption — nothing stopped
 * `solvedLog[0].rating` from being the *string* `"<img src=x onerror=alert(1)>"`, which would then
 * render unescaped and execute. Coercing every known-numeric field back to an actual number right
 * after every deepMerge (both a normal server load and an explicit import go through this) closes
 * it for every render site at once. RLS protects confidentiality between accounts, not the type-
 * safety of what's already inside your own JSON blob — and a bad value now round-trips to every
 * device you sign into instead of staying trapped in one browser, so this still matters here.
 */
function coerceNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeSolvedLog(list) {
  if (!Array.isArray(list)) return list;
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    p.rating = p.rating == null ? null : coerceNumber(p.rating, null);
    p.points = coerceNumber(p.points, 0);
    p.bonus = coerceNumber(p.bonus, 0);
  }
  return list;
}

function sanitizeTypes(data) {
  if (data.points) data.points.balance = coerceNumber(data.points.balance, 0);
  sanitizeSolvedLog(data.solvedLog);
  if (data.cf && Array.isArray(data.cf.unsolvedAttempted)) {
    for (const p of data.cf.unsolvedAttempted) {
      if (!p || typeof p !== "object") continue;
      p.rating = p.rating == null ? null : coerceNumber(p.rating, null);
      p.attemptCount = coerceNumber(p.attemptCount, 0);
    }
  }
  if (Array.isArray(data.rewards)) {
    for (const r of data.rewards) {
      if (r && typeof r === "object") r.cost = coerceNumber(r.cost, 1);
    }
  }
  if (Array.isArray(data.redemptions)) {
    for (const r of data.redemptions) {
      if (r && typeof r === "object") r.cost = coerceNumber(r.cost, 0);
    }
  }
  return data;
}

// Type-checked at every level, not just "does incoming exist": a hand-edited or partially
// corrupted backup file can have the right keys with the wrong-typed values (e.g. `solvedLog`
// as a string instead of an array). Blindly trusting incoming's type there used to let a single
// bad import corrupt the store into a shape every array-iterating page throws on. Now a type
// mismatch at any level just keeps base's value instead.
function deepMerge(base, incoming) {
  if (Array.isArray(base)) {
    return Array.isArray(incoming) ? incoming : base;
  }
  if (base !== null && typeof base === "object") {
    if (incoming === null || typeof incoming !== "object" || Array.isArray(incoming)) return base;
    const out = { ...base };
    for (const k of Object.keys(incoming)) {
      out[k] = k in base ? deepMerge(base[k], incoming[k]) : incoming[k];
    }
    return out;
  }
  return incoming !== undefined ? incoming : base;
}

/**
 * One-time migrations for data saved under an older schema `version`. Needed because deepMerge
 * only merges plain OBJECTS key-by-key — an array like `rewards` that's already saved always wins
 * wholesale over a new default (see deepMerge above), so changing a shipped default value only
 * affects brand-new accounts, never ones that already saved data under the old default. Each entry
 * is a pure `(data) -> data` step keyed by the version it upgrades TO; migrate() runs every step
 * between the stored version and current. In practice this now mostly matters for someone
 * re-importing an OLD exported backup file — a fresh signup's app_data starts at `{}` and has
 * nothing to migrate.
 */
const MIGRATIONS = {
  2: (data) => {
    // v1 -> v2: starter reward costs were halved (20/30/150 -> 10/15/75) when the points formula
    // dropped by a flat 5/solve (see gamification.js). Only touches the 3 known starter rewards,
    // and only when the cost still exactly matches the OLD default, so it can't clobber anything
    // else — there's no UI to edit a reward's cost today, so an exact match can only mean this
    // reward was never touched since it was created under the old default.
    const OLD_COSTS = { "r-youtube": 20, "r-treat": 30, "r-afternoon": 150 };
    const NEW_COSTS = { "r-youtube": 10, "r-treat": 15, "r-afternoon": 75 };
    for (const r of data.rewards) {
      if (r.id in OLD_COSTS && r.cost === OLD_COSTS[r.id]) r.cost = NEW_COSTS[r.id];
    }
    return data;
  },
  3: (data) => {
    // v2 -> v3: an earlier local-only version had a "save a handle, then separately verify it"
    // profile model with no accounts map at all. If it was already verified, keep it verified
    // (still resolves cleanly into v4 below); if not, that was never a real login in any later
    // model, so it's dropped back to unverified/blank instead of being trusted as-is.
    if (!(data.profile && data.profile.cfVerified && data.profile.cfHandle)) {
      const fresh = defaultData();
      data.profile = fresh.profile;
      data.roadmapProgress = fresh.roadmapProgress;
      data.points = fresh.points;
      data.solvedLog = fresh.solvedLog;
      data.cf = fresh.cf;
      data.rewards = fresh.rewards;
      data.redemptions = fresh.redemptions;
    }
    return data;
  },
  4: (data) => {
    // v3 -> v4: moved from local-only storage (with a local per-browser multi-handle `accounts`
    // map for switching between several verified handles on one browser — see git history) to
    // real server-backed accounts: one row per signed-in user, one Codeforces handle per account,
    // forever (see Store.verifyHandle). `accounts` no longer means anything under that model, and
    // `theme` moved out to its own always-local key (see js/theme.js) — neither belongs in the
    // server-synced blob. Only matters when importing an old exported backup file; a fresh
    // account's app_data starts at `{}` and never had either key.
    delete data.accounts;
    delete data.theme;
    return data;
  },
  5: (data) => {
    // v4 -> v5: price increase — youtube break 10 -> 15, treat/snack 15 -> 20 (afternoon
    // unchanged). Same "only if still at the exact old default" guard as the v1->v2 migration,
    // so a reward someone already redeemed against or otherwise diverged from the default isn't
    // silently overwritten.
    const OLD_COSTS = { "r-youtube": 10, "r-treat": 15 };
    const NEW_COSTS = { "r-youtube": 15, "r-treat": 20 };
    for (const r of data.rewards) {
      if (r.id in OLD_COSTS && r.cost === OLD_COSTS[r.id]) r.cost = NEW_COSTS[r.id];
    }
    return data;
  },
};

function migrate(data) {
  let version = data.version || 1;
  while (MIGRATIONS[version + 1]) {
    version += 1;
    data = MIGRATIONS[version](data) || data;
  }
  data.version = version;
  // Runs on every load, not just a version bump — see sanitizeTypes' own comment for why.
  return sanitizeTypes(data);
}

const Store = {
  _data: null,
  _loaded: false,
  _lastLoadedAt: 0,
  _saveTimer: null,
  _saveChain: Promise.resolve(),

  /** Synchronous, same shape/calling-convention every existing render function already expects.
   * Never throws, never blocks — returns fresh defaults until load() has actually resolved (pages
   * guard their own rendering on Store.isLoaded(), see js/shell.js, so this is a safety net, not
   * the real gate). */
  get data() {
    return this._data || defaultData();
  },

  isLoaded() {
    return this._loaded;
  },

  /** Fetches the signed-in account's row. Call once per page load, before any render logic runs. */
  async load() {
    if (!Auth.isSignedIn()) return { ok: false, error: "Not signed in" };
    try {
      const { data: row, error } = await supabaseClient
        .from("profiles")
        .select("cf_handle, cf_verified, app_data")
        .eq("id", Auth.user.id)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      const merged = migrate(deepMerge(defaultData(), (row && row.app_data) || {}));
      if (row) {
        // cf_handle/cf_verified are the source of truth for identity (they're what the DB
        // uniqueness constraint actually protects) — mirror them in, in case app_data ever
        // drifted from the two real columns.
        merged.profile.cfHandle = row.cf_handle || merged.profile.cfHandle;
        merged.profile.cfVerified = Boolean(row.cf_verified);
      }
      this._data = merged;
      this._loaded = true;
      this._lastLoadedAt = Date.now();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || "Network error" };
    }
  },

  /** Same as load(), but also tells every page to re-render — used for the focus-refetch below. */
  async reload() {
    const result = await this.load();
    if (result.ok) document.dispatchEvent(new CustomEvent("icpc:external-data-change"));
    return result;
  },

  /** Drops the cached row — called on sign-out, so the next sign-in never briefly shows stale data. */
  clear() {
    this._data = null;
    this._loaded = false;
  },

  /**
   * Same signature as the old local-only version: mutates the in-memory blob synchronously and
   * returns immediately — every existing call site (js/gamification.js, js/cf-sync.js, etc.) needs
   * no changes. What's different: this also schedules a debounced, serialized background save to
   * the server instead of an instant localStorage write. Routine writes stay optimistic (the UI
   * never waits on the network) — only Store.verifyHandle below is awaited by its caller.
   */
  update(mutator) {
    const d = this.data;
    if (!this._data) this._data = d;
    mutator(d);
    this._scheduleSave();
    return d;
  },

  _scheduleSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._saveChain = this._saveChain.then(() => this._writeNow());
    }, 400);
  },

  async _writeNow() {
    if (!Auth.isSignedIn() || !this._data) return { ok: false, error: "Not signed in" };
    try {
      const { error } = await supabaseClient.from("profiles").update({ app_data: this._data }).eq("id", Auth.user.id);
      if (error) {
        console.error("Failed to save.", error);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (e) {
      console.error("Failed to save.", e);
      return { ok: false, error: e.message || "Network error" };
    }
  },

  /** Waits for any pending debounced/queued save to actually land, returning its result. */
  async flush() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
      this._saveChain = this._saveChain.then(() => this._writeNow());
    }
    return this._saveChain;
  },

  /**
   * Links `handle` to the signed-in account, having already verified ownership (see
   * js/cf-verify.js CFVerify — call this only after its check succeeds, never speculatively).
   * Unlike every other write, this is AWAITED by its caller and NOT optimistic: it can legitimately
   * fail — a DB uniqueness constraint (supabase/migrations/20260917000000_cf_handle_uniqueness.sql)
   * rejects it if another account already verified this exact handle — and the caller needs to know
   * that before treating the account as verified. A returning account (gamificationStart already
   * set) keeps it; a first-time verification sets it to today.
   */
  async verifyHandle(handle) {
    if (!Auth.isSignedIn()) return { ok: false, error: "Not signed in" };
    const cleanHandle = handle.trim();
    const current = this.data;
    const nextData = {
      ...current,
      profile: {
        ...current.profile,
        cfHandle: cleanHandle,
        cfVerified: true,
        gamificationStart: current.profile.gamificationStart || new Date().toISOString().slice(0, 10),
      },
    };
    try {
      const { error } = await supabaseClient
        .from("profiles")
        .update({ cf_handle: cleanHandle, cf_verified: true, app_data: nextData })
        .eq("id", Auth.user.id);
      if (error) {
        const isDuplicate = error.code === "23505";
        return { ok: false, error: isDuplicate ? "That handle is already linked to another account." : error.message };
      }
      this._data = nextData;
      this._loaded = true;
      this._lastLoadedAt = Date.now();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || "Network error" };
    }
  },

  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  /**
   * Overwrites the signed-in account's data with `jsonString`'s contents. profile.cfHandle/
   * cfVerified/gamificationStart are deliberately forced back to whatever the server already has —
   * discarding anything the file itself claims for those three fields — before saving. Without
   * this, Import would be a trivial way to "verify" any unclaimed handle by typing it into a JSON
   * file, completely bypassing CFVerify's actual proof-of-ownership check. Every other field
   * imports as given, still passed through migrate()/sanitizeTypes() as always.
   */
  async importJSON(jsonString) {
    if (!Auth.isSignedIn()) return { ok: false, error: "Not signed in" };
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return { ok: false, error: `Couldn't parse that JSON: ${e.message}` };
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "That file doesn't look like an icpc-prep-hub backup (expected a JSON object)." };
    }
    const current = this.data;
    const merged = migrate(deepMerge(defaultData(), parsed));
    merged.profile.cfHandle = current.profile.cfHandle;
    merged.profile.cfVerified = current.profile.cfVerified;
    merged.profile.gamificationStart = current.profile.gamificationStart;
    this._data = merged;
    this._loaded = true;
    return this._writeNow();
  },

  /** Wipes roadmap/points/solves/rewards back to defaults — keeps this account's identity intact
   * (cfHandle/cfVerified/gamificationStart), matching the button's own copy: it clears progress,
   * not your verified account. */
  async resetAll() {
    if (!Auth.isSignedIn()) return { ok: false, error: "Not signed in" };
    const current = this.data;
    const fresh = defaultData();
    fresh.profile.cfHandle = current.profile.cfHandle;
    fresh.profile.cfVerified = current.profile.cfVerified;
    fresh.profile.gamificationStart = current.profile.gamificationStart;
    this._data = fresh;
    this._loaded = true;
    return this._writeNow();
  },
};

/**
 * Multi-device freshness: refetch when this tab regains focus/visibility, rather than a live
 * Realtime subscription. The problem this exists for is a device-SWITCH scenario (phone vs.
 * desktop), not two tabs open side by side needing sub-second sync, so a persistent WebSocket per
 * tab (with its own reconnect handling, replication setup) isn't worth the added complexity here.
 * 15s debounce so rapid tab-switching doesn't refetch on every single glance back at the page.
 */
function maybeRefetch() {
  if (!Auth.isSignedIn()) return;
  if (Date.now() - Store._lastLoadedAt < 15000) return;
  Store.reload();
}

/**
 * The other direction of the same freshness problem: writes are debounced ~400ms (see
 * _scheduleSave above), so an action immediately followed by closing the tab, navigating to
 * another page, or switching tabs could lose that last change — the scheduled save just never
 * gets to fire. This is a genuinely multi-page site (every nav link is a full page load, not an
 * SPA route), so "the user is about to leave" is common, not an edge case. `visibilitychange` to
 * "hidden" fires reliably before teardown in every one of those cases (unlike `beforeunload`,
 * which is increasingly restricted and doesn't fire on a plain tab-switch at all), so flushing
 * there catches the large majority of this risk for free. Store.flush() is a safe no-op if
 * nothing was pending.
 */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    maybeRefetch();
  } else {
    Store.flush();
  }
});
window.addEventListener("focus", maybeRefetch);
window.addEventListener("pagehide", () => Store.flush());
