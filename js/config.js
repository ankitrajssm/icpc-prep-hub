/**
 * Supabase project config. Required now, not optional — js/auth.js (sign-in) and js/storage.js
 * (every account's roadmap/points/solves/rewards) both depend on this being a real project, loaded
 * on every page. (The same project also backs the separate, still-optional Codeforces baseline
 * comparison feature — the Tourist / Top 500 / Top 10,000 / Average user tiers on the Codeforces
 * page — see README's "Codeforces baseline data.")
 *
 * These are NOT secrets — the "anon" key is Supabase's public client key, meant to be shipped in
 * frontend code. Every table it can reach is protected by its own row-level security policy (see
 * supabase/migrations/), not by keeping this key hidden. It's safe to commit your real values here.
 *
 * To set this up:
 *   1. Create a free project at https://supabase.com.
 *   2. Apply supabase/migrations/ — either `npx supabase db push` (after `supabase login`
 *      and `supabase link`), or paste each migration file's contents into the SQL editor, in
 *      filename (timestamp) order.
 *   3. In Project Settings -> API, copy the "Project URL" and "anon public" key below.
 *   4. Auth -> Providers: confirm Email is enabled. Auth -> URL Configuration: add this site's
 *      URL(s) (e.g. your local dev server and your real deployed URL) to Redirect URLs, or the
 *      magic-link click-through will fail (the OTP-code fallback in the sign-in form still works
 *      regardless — see README's "Account setup").
 *   5. Optionally deploy and schedule supabase/functions/sync-cf-baseline (see README) for the
 *      Codeforces baseline comparison tiers — unrelated to sign-in, and the rest of the app works
 *      fully without it.
 *
 * Leaving the placeholders as-is disables sign-in entirely (js/auth.js's isConfigured() returns
 * false, and the sign-in gate says so) — there's no local-only fallback mode anymore.
 */
const SUPABASE_CONFIG = {
  url: "https://ieiamgyuhstmjajpcuxj.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaWFtZ3l1aHN0bWphanBjdXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTUzNjcsImV4cCI6MjEwNDk5MTM2N30.Mz_1SpBj5MCJJalfQjonqps3Eh39WdNv-xfNslxaudw",
};
