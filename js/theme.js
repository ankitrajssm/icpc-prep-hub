/**
 * Theme handling: "system" follows prefers-color-scheme; "light"/"dark" are explicit manual
 * overrides. Applied via a data-theme attribute on <html>.
 *
 * Kept in its own tiny localStorage key, deliberately NOT synced through Store/the server — it's a
 * per-device cosmetic preference with no privacy/sync stakes, and syncing it would create a real
 * chicken-and-egg problem: it needs to apply instantly on load (before any network round-trip) to
 * avoid a flash of the wrong theme, including while signed out and before there's any account to
 * attach a preference to.
 */
const THEME_KEY = "icpc-prep-hub:theme";

const Theme = {
  get() {
    try {
      return localStorage.getItem(THEME_KEY) || "system";
    } catch (e) {
      return "system";
    }
  },

  set(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      // Best-effort — a private-browsing tab or a full storage quota just means the choice
      // won't persist past this page view, not worth surfacing an error for a cosmetic setting.
    }
  },

  apply() {
    const theme = this.get();
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
    this.updateToggleLabel();
  },

  cycle() {
    const order = ["system", "light", "dark"];
    const current = this.get();
    const next = order[(order.indexOf(current) + 1) % order.length];
    this.set(next);
    this.apply();
  },

  updateToggleLabel() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const theme = this.get();
    const icons = { system: "\u{1F5A5}️ Auto", light: "☀️ Light", dark: "\u{1F319} Dark" };
    btn.textContent = icons[theme];
  },

  init() {
    this.apply();
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.addEventListener("click", () => this.cycle());
  },
};
