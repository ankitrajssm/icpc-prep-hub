// Incremental Codeforces baseline sync, triggered every few minutes by a pg_cron job
// (see README "Codeforces baseline data" for the cron setup). One invocation processes
// as many sampled users as fit in a safe time budget, respecting Codeforces' ~1-request/2s
// rate limit and Supabase Edge Functions' own wall-clock execution limit (150s free tier) —
// the *job* spans many short invocations over ~4-5 hours once a day; no single invocation
// runs long, and it checkpoints progress after every single user (not just at the end of a
// batch), so a run that gets killed by the platform never loses more than one user's work.
//
// State machine, persisted in cf_baseline_sync_state (a singleton row) between runs:
//   idle -> (new day) -> top500 -> top10000 -> average -> idle
// Each non-idle phase works through handles in `pool`, moving each into `accumulated` (with
// a DB write after every single one). When `pool` empties, the phase's results are
// aggregated and published to cf_baseline_data, and the next phase begins.
//
// Deno.env.get('SUPABASE_URL') / ('SUPABASE_SERVICE_ROLE_KEY') are auto-injected by
// Supabase into every Edge Function — no manual secret setup needed for these two.
//
// This function has `verify_jwt = false` (see supabase/config.toml) so the cron job can call it
// without a user session — which also means its URL is invocable by anyone who reads the client
// bundle, not just the cron job. Two mitigations against that:
//  1. Optional shared-secret gate: if a `CRON_SYNC_SECRET` env var is set (`supabase secrets set
//     CRON_SYNC_SECRET=<random value>`), a request must send it back as the `x-cron-secret`
//     header (configure this on the pg_cron job's net.http_post call) or gets a 401. Unset by
//     default so existing deployments keep working without extra setup — set it to actually
//     close this off.
//  2. Optimistic concurrency on cf_baseline_sync_state: every write is conditioned on the
//     `updated_at` this invocation last read. Two invocations racing (e.g. someone hammering this
//     URL while the real cron-triggered run is mid-phase) can no longer silently clobber each
//     other's progress with a lost update — the loser's write matches 0 rows and it stops
//     immediately instead of continuing to burn Codeforces API calls and overwrite the winner's
//     checkpoint.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CF_API = "https://codeforces.com/api";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const AVERAGE_BAND = 200;
const SAMPLE_TARGET = 1500; // real users sampled per tier
const REQUEST_DELAY_MS = 2000; // Codeforces' courtesy rate limit
// Stop pulling more users once this much wall-clock time has passed in this invocation,
// leaving a big safety margin below Supabase's 150s (free tier) hard kill — a batch of 40
// at 2s/request alone is 80s before any actual network/parse time, which measured out to
// occasionally exceeding 150s in practice. A time budget (checked before each user, not a
// fixed count) adapts to real observed latency instead of guessing a fixed batch size.
const TIME_BUDGET_MS = 100_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cfGet(endpoint: string, params: string) {
  const url = `${CF_API}/${endpoint}${params ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${endpoint}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== "OK") throw new Error(`${endpoint}: ${json.comment || "API returned an error"}`);
  return json.result;
}

function cleanTags(tags: string[] | undefined) {
  return (tags || []).filter((t) => !t.startsWith("*"));
}

async function fetchUserSolves(handle: string): Promise<{ tags: string[]; dateMs: number }[]> {
  const subs = await cfGet("user.status", `handle=${encodeURIComponent(handle)}`);
  const solvedMap = new Map<string, { tags: string[]; dateMs: number }>();
  for (const sub of subs) {
    if (sub.verdict !== "OK") continue;
    const key = `${sub.problem.contestId}${sub.problem.index}`;
    if (solvedMap.has(key)) continue;
    solvedMap.set(key, { tags: sub.problem.tags || [], dateMs: sub.creationTimeSeconds * 1000 });
  }
  return [...solvedMap.values()];
}

function computeWindow(solves: { tags: string[] }[]) {
  const problemCount = solves.length;
  const tagCounts: Record<string, number> = {};
  for (const p of solves) {
    for (const tag of cleanTags(p.tags)) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  const tagRatios: Record<string, number> = {};
  for (const [tag, count] of Object.entries(tagCounts)) {
    tagRatios[tag] = problemCount ? Number((count / problemCount).toFixed(4)) : 0;
  }
  return { problemCount, tagRatios };
}

function aggregateWindows(perUserWindows: { problemCount: number; tagRatios: Record<string, number> }[]) {
  const n = perUserWindows.length || 1;
  const avgSolvedCount = Number((perUserWindows.reduce((s, w) => s + w.problemCount, 0) / n).toFixed(1));
  const tagSums: Record<string, number> = {};
  for (const w of perUserWindows) {
    for (const [tag, ratio] of Object.entries(w.tagRatios)) tagSums[tag] = (tagSums[tag] || 0) + ratio;
  }
  const tagRatios: Record<string, number> = {};
  for (const [tag, sum] of Object.entries(tagSums)) tagRatios[tag] = Number((sum / n).toFixed(4));
  return { problemCount: avgSolvedCount, tagRatios, sampleSize: n };
}

function spreadSample<T>(pool: T[], n: number): T[] {
  if (pool.length <= n) return pool;
  const step = pool.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(i * step)]);
  return out;
}

function isSameUTCDate(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

const TIER_META: Record<string, { label: string }> = {
  top500: { label: "Top 500" },
  top10000: { label: "Top 10,000" },
  average: { label: "Average user" },
};

Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get("CRON_SYNC_SECRET");
    if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
      return new Response(JSON.stringify({ status: "error", message: "unauthorized" }), { status: 401 });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: state } = await supabase.from("cf_baseline_sync_state").select("*").eq("id", true).maybeSingle();

    const now = new Date();
    const isIdleToday = state && state.phase === "idle" && isSameUTCDate(new Date(state.updated_at), now);
    if (isIdleToday) {
      return new Response(JSON.stringify({ status: "idle", note: "already completed a full cycle today" }), { status: 200 });
    }

    // --- Start a new daily cycle: refresh cutoffs/percentiles/tourist, seed the top500 pool. ---
    if (!state || state.phase === "idle") {
      const ratedUsers = await cfGet("user.ratedList", "activeOnly=true");
      ratedUsers.sort((a: any, b: any) => b.rating - a.rating);
      const cutoff500 = ratedUsers[Math.min(499, ratedUsers.length - 1)].rating;
      const cutoff10000 = ratedUsers[Math.min(9999, ratedUsers.length - 1)].rating;
      const medianRating = ratedUsers[Math.floor(ratedUsers.length / 2)].rating;

      const percentiles: Record<number, number> = {};
      for (let p = 1; p <= 99; p++) {
        const idx = Math.min(ratedUsers.length - 1, Math.floor((ratedUsers.length * p) / 100));
        percentiles[p] = ratedUsers[idx].rating;
      }
      await supabase.from("cf_percentiles").upsert({ id: true, percentiles, updated_at: now.toISOString() });

      await sleep(REQUEST_DELAY_MS);
      const touristSolves = await fetchUserSolves("tourist");
      const touristAllTime = computeWindow(touristSolves);
      const touristLastYear = computeWindow(touristSolves.filter((p) => p.dateMs >= Date.now() - YEAR_MS));
      await supabase.from("cf_baseline_data").upsert({
        tier: "tourist",
        label: "Tourist",
        rating_cutoff: null,
        windows: { allTime: { ...touristAllTime, sampleSize: 1 }, lastYear: { ...touristLastYear, sampleSize: 1 } },
        updated_at: now.toISOString(),
      });

      const notTourist = (u: any) => u.handle.toLowerCase() !== "tourist";
      const top500Pool = ratedUsers.filter((u: any) => u.rating >= cutoff500 && notTourist(u));
      const pool = spreadSample(top500Pool, SAMPLE_TARGET).map((u: any) => u.handle);

      await supabase.from("cf_baseline_sync_state").upsert({
        id: true,
        phase: "top500",
        pool,
        accumulated: [],
        cutoff500,
        cutoff10000,
        median_rating: medianRating,
        updated_at: now.toISOString(),
      });

      return new Response(JSON.stringify({ status: "started new cycle", phase: "top500", poolSize: pool.length }), { status: 200 });
    }

    // --- Continue the current phase: work through the pool until the time budget runs out,
    // checkpointing (persisting pool + accumulated) after every single user so a run that
    // gets killed by the platform never loses more than the one fetch in flight. ---
    const invocationStart = Date.now();
    let pool: string[] = [...(state.pool || [])];
    let accumulated: any[] = [...(state.accumulated || [])];
    let expectedUpdatedAt: string = state.updated_at;
    const handledThisRun: { handle: string; status: "fetched" | "skipped" }[] = [];

    while (pool.length > 0 && Date.now() - invocationStart < TIME_BUDGET_MS) {
      const handle = pool[0];
      await sleep(REQUEST_DELAY_MS);
      try {
        const solves = await fetchUserSolves(handle);
        accumulated.push({
          handle,
          allTime: computeWindow(solves),
          lastYear: computeWindow(solves.filter((p) => p.dateMs >= Date.now() - YEAR_MS)),
        });
        console.log(`Fetched ${handle}: ${solves.length} solves`);
        handledThisRun.push({ handle, status: "fetched" });
      } catch (e) {
        console.log(`Skipping ${handle}: ${(e as Error).message}`);
        handledThisRun.push({ handle, status: "skipped" });
      }
      pool = pool.slice(1);
      const newUpdatedAt = new Date().toISOString();
      // Conditioned on the updated_at we last saw: if another invocation wrote to this row
      // concurrently, this matches 0 rows and `updated` comes back empty — see the top-of-file
      // comment. That means OUR in-memory pool/accumulated are now stale relative to what's
      // persisted, so stop rather than keep looping on outdated state.
      const { data: updated, error: updateErr } = await supabase
        .from("cf_baseline_sync_state")
        .update({ pool, accumulated, updated_at: newUpdatedAt })
        .eq("id", true)
        .eq("updated_at", expectedUpdatedAt)
        .select("updated_at");
      if (updateErr) throw updateErr;
      if (!updated || updated.length === 0) {
        return new Response(
          JSON.stringify({
            status: "conflict",
            note: "sync state was updated by another concurrent invocation; stopped to avoid clobbering its progress",
            phase: state.phase,
            fetchedThisRun: handledThisRun.length,
          }),
          { status: 200 }
        );
      }
      expectedUpdatedAt = newUpdatedAt;
    }

    if (pool.length > 0) {
      return new Response(
        JSON.stringify({
          status: "time budget reached",
          phase: state.phase,
          fetchedThisRun: handledThisRun.length,
          handledThisRun,
          remaining: pool.length,
        }),
        { status: 200 }
      );
    }

    // --- Phase's pool is empty: aggregate and publish this tier, advance to the next phase. ---
    const allTimeAgg = aggregateWindows(accumulated.map((a: any) => a.allTime));
    const lastYearAgg = aggregateWindows(accumulated.map((a: any) => a.lastYear));
    const ratingCutoff = state.phase === "top500" ? state.cutoff500 : state.phase === "top10000" ? state.cutoff10000 : state.median_rating;

    await supabase.from("cf_baseline_data").upsert({
      tier: state.phase,
      label: TIER_META[state.phase].label,
      rating_cutoff: ratingCutoff,
      windows: { allTime: allTimeAgg, lastYear: lastYearAgg },
      updated_at: now.toISOString(),
    });

    const nextPhase = state.phase === "top500" ? "top10000" : state.phase === "top10000" ? "average" : "idle";
    let nextPool: string[] = [];

    if (nextPhase !== "idle") {
      await sleep(REQUEST_DELAY_MS);
      const ratedUsers = await cfGet("user.ratedList", "activeOnly=true");
      ratedUsers.sort((a: any, b: any) => b.rating - a.rating);
      const notTourist = (u: any) => u.handle.toLowerCase() !== "tourist";
      const poolUsers =
        nextPhase === "top10000"
          ? ratedUsers.filter((u: any) => u.rating >= state.cutoff10000 && notTourist(u))
          : ratedUsers.filter((u: any) => u.rating >= state.median_rating - AVERAGE_BAND && u.rating <= state.median_rating + AVERAGE_BAND && notTourist(u));
      nextPool = spreadSample(poolUsers, SAMPLE_TARGET).map((u: any) => u.handle);
    }

    await supabase
      .from("cf_baseline_sync_state")
      .update({ phase: nextPhase, pool: nextPool, accumulated: [], updated_at: now.toISOString() })
      .eq("id", true);

    return new Response(JSON.stringify({ status: "phase complete", finishedPhase: state.phase, nextPhase, nextPoolSize: nextPool.length }), { status: 200 });
  } catch (e) {
    console.error("sync-cf-baseline failed:", e);
    return new Response(JSON.stringify({ status: "error", message: (e as Error).message }), { status: 500 });
  }
});
