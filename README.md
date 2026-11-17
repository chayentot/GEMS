# GEMS Mining

A Next.js + Supabase starter for the GEMS gemstone-mining platform.

## Current platform rules

- 1 GEMS = ₱1 PHP accounting value.
- Recharge fee: 0%; recharge requests are credited only after admin verification.
- Withdrawal fee: 6%; minimum request: 150 GEMS.
- Purchased and mined GEMS are both eligible for withdrawal requests.
- Each mining cycle is capped at 24 hours; players can collect before the cycle ends.
- Each new account receives one free Level 1 Garnet.
- Additional Garnet purchases cost 1 GEMS.
- Gemstone mining uses the owner's exact 10-gem table: per-level gemstone units per minute, level-up unit costs, conversion units per GEMS, and previous-gemstone unlock requirements.
- Gemstone units are collected into each owned gemstone balance; players explicitly convert whole GEMS into the GEMS wallet, preserving any remaining units.
- The original Garnet is free at Level 1 for new accounts. The other nine gemstones unlock by spending the exact required units of the previous gemstone.
- Level cap: 10. Mining cycle: maximum 24 hours; players may collect before the cycle ends.
- Withdrawal: minimum 150 GEMS, 6% fee, 94% net PHP payout, subject to admin review.

## 1. Apply the Supabase database migration

**For the existing GEMS project, do not run migration 001.** Your database already uses the original tables and contains player accounts and wallet records.

1. Open your Supabase project dashboard.
2. Go to **SQL Editor** and create a new query.
3. Open [003_original_gem_economy.sql](https://github.com/chayentot/GEMS/blob/main/supabase/migrations/003_original_gem_economy.sql).
4. Copy the complete SQL file into the Supabase SQL Editor and run it.
5. Check the Results panel. It should finish without an error.
6. Run the verification query at the bottom of the migration and confirm that all 10 gemstones appear.

Migration 003 adds the confirmed earning arrays, conversion rates, level-up costs, unlock requirements, gemstone-unit balances, and secure RPC functions. It is designed to preserve existing accounts, wallet balances and the free Garnet assignment.

**Important:** `001_gems_schema.sql` is for a fresh database only. Your current project uses the original schema with `mining_sessions` and `recharge_orders`; do not run `001_gems_schema.sql` on it. Run `002_legacy_schema_compat.sql` first if you have not already done so, then run `003_original_gem_economy.sql`. Migration 003 adds the original 10-gem economy fields and mining, conversion, unlocking and level-up RPCs without replacing your existing player records or wallets.

## 2. Configure the frontend environment

Create a local file named `.env.local` (do not commit it) using the placeholders in [`.env.example`](.env.example):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Find these values in Supabase → **Project Settings → API**. Use the publishable key (or legacy anon key).

Never put a Supabase service-role/secret key in frontend code, a public GitHub repository, or a browser environment variable.

## 3. Run locally

Install Node.js LTS, download/clone this repository, then run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 4. Create your first administrator

1. Register your own account from the GEMS website.
2. If email confirmation is enabled, confirm your email and sign in.
3. In Supabase → SQL Editor, run this statement with your registered email:

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'YOUR-ADMIN-EMAIL'
on conflict do nothing;
```

The initial release has no visual admin dashboard. For the original database foundation, admins can review requests in Supabase Table Editor and use the protected admin RPC functions while testing:

- `admin_approve_recharge(p_order_id)`
- `admin_reject_recharge(p_request_id)`
- `admin_approve_withdrawal(p_request_id)`
- `admin_reject_withdrawal(p_request_id)`
- `admin_mark_withdrawal_paid(p_request_id)`

Only mark a withdrawal paid after the payout has actually been sent.

## 5. Connect Supabase Auth to the website URL

In Supabase → **Authentication → URL Configuration**, set the Site URL to the final website address and add the corresponding sign-in/confirmation redirect URLs. The exact URL depends on the hosting method selected.


## 6. Install the persistent Gemstone Frontier backend

The Gemstone Frontier world is an optional game mode and uses a separate **Gold** balance. It does not change the GEMS wallet, recharge approvals, withdrawal requests, referral commissions, or the existing ten-gem mining economy.

After your existing GEMS migrations are installed (including the legacy compatibility and original economy migrations, plus the referral migrations used by your current project):

1. Open Supabase → SQL Editor.
2. Open [012_gemstone_frontier_world.sql](supabase/migrations/012_gemstone_frontier_world.sql) from this repository.
3. Copy the complete SQL file into a new SQL Editor query and run it once.
4. Confirm the query completes successfully.
5. Sign in to GEMS and open **Mining World**. Supabase creates the player's world and starter Garnet Mine automatically.

The migration creates an independent catalog, per-player Gold balance, facility ownership/levels, factory input inventory and shipment queue. Production and unlock/upgrade costs are processed by authenticated database functions. Offline production is capped at 24 hours per visit. The browser cannot directly edit Gold, facility ownership, levels, or inventory.

Do not run `001_gems_schema.sql` on the existing GEMS database. Migration 012 is additive and is intended for the original database described above.

## Hosting note: GitHub + Supabase

GitHub stores the source code; Supabase provides authentication and database services. Supabase does not host this Next.js website. GitHub Pages may be usable if the app can be built as a static export, but it needs a compatible configuration and route testing. I will verify that before asking you to configure hosting. We do not need to use Vercel if we can deploy successfully with GitHub Pages.

## Important before accepting real money

This is an MVP foundation, not a finished financial service. Recharge and withdrawal requests are manual and require admin review. Before accepting customer funds or promising cash withdrawals, integrate legitimate payment and payout providers, implement admin audit controls, fraud/identity checks, customer support and clear terms/privacy disclosures, and obtain Philippine legal/accounting advice on applicable payment, consumer-protection, tax and licensing requirements. Have the SQL and economy independently reviewed before production.
