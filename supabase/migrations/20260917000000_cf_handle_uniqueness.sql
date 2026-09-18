-- One Codeforces handle can only ever be linked to one verified account.
--
-- Enforced at the DB level, not just client-side, because RLS scopes SELECT to
-- your own row — a user can't see another user's row to check for a collision
-- themselves before writing, so only a real constraint (checked atomically by
-- Postgres on write) can actually stop two accounts from claiming the same
-- handle. Partial index (only over cf_verified = true rows) so an account that
-- hasn't verified anything yet, or has been reset back to unverified, never
-- collides with itself or blocks a handle it no longer holds.

create unique index if not exists profiles_cf_handle_verified_unique
  on public.profiles (lower(cf_handle))
  where cf_verified = true;
