/** Reward catalog + redemption history, self-refreshing on redeem/remove. */
const RewardsUI = {
  _justRedeemedId: null, // briefly set right after a successful redeem, to play a one-shot animation on that tile

  render(listRoot, historyRoot) {
    if (!listRoot) return;
    const { rewards, points } = Store.data;
    if (!rewards.length) {
      listRoot.innerHTML = `<p class="empty-note">No rewards yet &mdash; add one below.</p>`;
    } else {
      listRoot.innerHTML = rewards
        .map(
          (r) => `
          <div class="reward-tile${r.id === this._justRedeemedId ? " reward-tile-redeemed" : ""}">
            ${isLockedReward(r) ? "" : `<button type="button" class="btn-icon btn-remove-reward" data-reward-id="${escapeHtml(r.id)}" aria-label="Remove reward">&times;</button>`}
            <span class="reward-name">${escapeHtml(r.name)}</span>
            <span class="reward-cost">${escapeHtml(r.cost)} pts</span>
            <button type="button" class="btn-secondary btn-redeem" data-reward-id="${escapeHtml(r.id)}" ${points.balance < r.cost ? "disabled" : ""}>Redeem</button>
          </div>`
        )
        .join("");
    }
    this._justRedeemedId = null;

    listRoot.querySelectorAll(".btn-redeem").forEach((btn) => {
      btn.addEventListener("click", () => {
        const result = Gamification.redeemReward(btn.dataset.rewardId);
        if (result.ok) this._justRedeemedId = btn.dataset.rewardId;
        this.render(listRoot, historyRoot);
        Nav.updatePointsBadge();
      });
    });
    listRoot.querySelectorAll(".btn-remove-reward").forEach((btn) => {
      btn.addEventListener("click", () => {
        Gamification.removeReward(btn.dataset.rewardId);
        this.render(listRoot, historyRoot);
      });
    });

    if (historyRoot) {
      const redemptions = Store.data.redemptions.slice(0, 15);
      historyRoot.innerHTML = redemptions.length
        ? redemptions
            .map(
              (r) => `
            <div class="redemption-row">
              <span>${escapeHtml(r.rewardName)}</span>
              <span>${escapeHtml(r.cost)} pts</span>
              <span>${new Date(r.date).toLocaleString()}</span>
            </div>`
            )
            .join("")
        : `<p class="empty-note">No redemptions yet.</p>`;
    }
  },
};
