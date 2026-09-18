/**
 * Initializes the single shared Supabase client from js/config.js — used by js/auth.js (sign-in)
 * and js/storage.js (account data) on every page, and by js/cf-baseline.js (the separate, still-
 * optional Codeforces baseline comparison feature) on codeforces.html/team.html. `CLOUD_ENABLED`
 * being false means this deployment was never configured (see js/config.js) — js/auth.js's
 * isConfigured() reflects that, and the sign-in gate says so instead of the app silently breaking.
 */
const CLOUD_ENABLED = Boolean(
  window.supabase &&
    SUPABASE_CONFIG.url &&
    SUPABASE_CONFIG.anonKey &&
    !SUPABASE_CONFIG.url.startsWith("YOUR_") &&
    !SUPABASE_CONFIG.anonKey.startsWith("YOUR_")
);

const supabaseClient = CLOUD_ENABLED ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey) : null;
