/**
 * The shared "sign in" gate, mounted by js/shell.js into #auth-gate on every gated page — one
 * implementation instead of duplicating sign-in markup per page. Reuses the .login-gate/.login-card
 * classes from this project's earlier local-login design (css/styles.css) as-is.
 */
const AuthUI = {
  _email: "", // remembered across the email-sent -> code-entry step, so the code form knows who it's for

  mount(container) {
    if (!container) return;
    if (!Auth.isConfigured()) {
      container.hidden = false;
      container.innerHTML = `
        <div class="login-gate">
          <div class="login-card">
            <h1 class="login-title">Accounts aren't set up on this deployment</h1>
            <p class="login-subtitle">This deployment doesn't have Supabase configured (see js/config.js), so there's nowhere to sign in to.</p>
          </div>
        </div>
      `;
      return;
    }
    container.hidden = false;
    this._renderEmailStep(container);
  },

  unmount(container) {
    if (!container) return;
    container.hidden = true;
    container.innerHTML = "";
  },

  _renderEmailStep(container) {
    container.innerHTML = `
      <div class="login-gate">
        <div class="login-card">
          <h1 class="login-title">Sign in</h1>
          <p class="login-subtitle">
            Enter your email for a one-time sign-in link &mdash; no password. Your Codeforces
            handle gets linked (and verified) once you're signed in, on the Dashboard.
          </p>
          <form id="auth-email-form" class="login-form">
            <label for="auth-email-input">Email</label>
            <input type="email" id="auth-email-input" placeholder="you@example.com" autocomplete="email" required />
            <button type="submit" class="btn-primary login-submit">Send magic link</button>
          </form>
          <span id="auth-email-status" class="sync-status"></span>
        </div>
      </div>
    `;

    $("auth-email-form").addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const email = $("auth-email-input").value.trim();
      if (!email) return;
      const submitBtn = evt.target.querySelector('button[type="submit"]');
      const statusEl = $("auth-email-status");
      submitBtn.disabled = true; // guards a rapid double-click sending two magic-link emails
      statusEl.textContent = "Sending…";
      statusEl.className = "sync-status";
      const result = await Auth.signInWithEmail(email);
      if (!result.ok) {
        submitBtn.disabled = false;
        statusEl.textContent = `Couldn't send the link (${result.error}). Try again.`;
        statusEl.className = "sync-status error";
        return;
      }
      this._email = email;
      this._renderCodeStep(container);
    });
  },

  _renderCodeStep(container) {
    container.innerHTML = `
      <div class="login-gate">
        <div class="login-card">
          <h1 class="login-title">Check your email</h1>
          <p class="login-subtitle">
            We sent a sign-in link to <strong>${escapeHtml(this._email)}</strong> &mdash; click it
            to come back here signed in. Or paste the 6-digit code from that same email below.
          </p>
          <form id="auth-code-form" class="login-form">
            <label for="auth-code-input">6-digit code</label>
            <input type="text" id="auth-code-input" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" required />
            <button type="submit" class="btn-primary login-submit">Verify code</button>
          </form>
          <span id="auth-code-status" class="sync-status"></span>
          <button type="button" id="auth-use-different-email" class="btn-icon">Use a different email</button>
        </div>
      </div>
    `;

    $("auth-code-form").addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const token = $("auth-code-input").value.trim();
      if (!token) return;
      const submitBtn = evt.target.querySelector('button[type="submit"]');
      const statusEl = $("auth-code-status");
      submitBtn.disabled = true; // guards a rapid double-click/double-submit of the same code
      statusEl.textContent = "Checking…";
      statusEl.className = "sync-status";
      const result = await Auth.verifyEmailCode(this._email, token);
      if (!result.ok) {
        submitBtn.disabled = false;
        statusEl.textContent = `That code didn't work (${result.error}). Check the email and try again.`;
        statusEl.className = "sync-status error";
        return;
      }
      // A successful verifyOtp already flips Auth.session via onAuthStateChange, which
      // js/shell.js's icpc:auth-changed listener reacts to — nothing else to do here.
    });

    $("auth-use-different-email").addEventListener("click", () => this._renderEmailStep(container));
  },
};
