/**
 * Supabase Auth: magic-link (passwordless) email sign-in. Owns only *auth* state (are we signed
 * in, as whom) — never touches app data (roadmap/points/solves/etc.), that's js/storage.js's job
 * once Auth says who's signed in. Uses the same `supabaseClient` js/cf-baseline.js already talks
 * to for the (unrelated) public baseline-comparison feature — one client instance for the whole
 * app, not two.
 */
const Auth = {
  client: supabaseClient,
  session: null,
  user: null, // session?.user ?? null, kept as its own field so callers don't have to null-chain
  ready: null, // Promise<void>, resolves once the first getSession() check has completed

  /** Whether this deployment even has Supabase configured — same gate js/cf-baseline.js uses. */
  isConfigured() {
    return CLOUD_ENABLED;
  },

  isSignedIn() {
    return Boolean(this.user);
  },

  _setSession(session) {
    const wasSignedIn = this.isSignedIn();
    this.session = session;
    this.user = session ? session.user : null;
    if (wasSignedIn !== this.isSignedIn() || wasSignedIn) {
      // Fires on every real transition (signed out -> in, in -> out), and also on a same-state
      // refresh while already signed in (e.g. a token refresh swapping in a new session object) —
      // harmless for listeners, which just re-render from Store's current state either way.
      document.dispatchEvent(new CustomEvent("icpc:auth-changed"));
    }
  },

  init() {
    if (!this.isConfigured()) {
      this.ready = Promise.resolve();
      return;
    }
    this.ready = this.client.auth.getSession().then(({ data }) => {
      this._setSession(data.session);
    });
    this.client.auth.onAuthStateChange((_event, session) => {
      this._setSession(session);
    });
  },

  /**
   * Sends a magic-link email. `emailRedirectTo` sends the user back to whatever page they
   * requested it from (no dedicated callback page needed — supabase-js's default
   * `detectSessionInUrl: true` parses the token out of the URL hash automatically on load).
   */
  async signInWithEmail(email) {
    try {
      const { error } = await this.client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.href, shouldCreateUser: true },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || "Network error" };
    }
  },

  /**
   * Every magic-link email Supabase sends also contains a 6-digit OTP code alongside the link —
   * this redeems that code directly, without needing to click through. Same "live path + manual
   * fallback" shape as js/cf-verify.js's checkLive/checkManual, and the fast way to repeat-test
   * sign-in locally without re-clicking a fresh email link every time.
   */
  async verifyEmailCode(email, token) {
    try {
      const { error } = await this.client.auth.verifyOtp({ email, token, type: "email" });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || "Network error" };
    }
  },

  /**
   * Flushes any pending debounced Store save BEFORE actually signing out — writes are debounced
   * ~400ms (see js/storage.js), so making a change and immediately signing out used to lose it
   * silently: the scheduled save would still fire later, but by then Store.clear() (triggered by
   * this very sign-out, see js/shell.js) had already dropped the in-memory data it needed to send,
   * so _writeNow() found nothing to write and quietly no-op'd. Flushing first means the write lands
   * while the session (and RLS write access) is still valid.
   */
  async signOut() {
    await Store.flush();
    try {
      const { error } = await this.client.auth.signOut();
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || "Network error" };
    }
  },
};

Auth.init();
