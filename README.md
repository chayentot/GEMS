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
- Starter Garnet sample mining rate: 0.01 GEMS/hour, multiplied by gemstone level.
- Diamond/GEMS conversion is not enabled because its direction and rate have not been finalized.

The other gemstone names, unlock prices and mining rates are not finalized. Add or update them in the `gemstones` table only after confirming the official game economy.

## 1. Apply the Supabase database migration

1. Open your Supabase project dashboard.
2. Go to **SQL Editor** and create a new query.
3. Open [the migration file in this GitHub repository](https://github.com/chayentot/GEMS/blob/main/supabase/migrations/001_gems_schema.sql).
4. Copy the complete SQL into the Supabase SQL Editor and run it.
5. Check the Results panel for errors before continuing.

The migration creates the player profiles, wallets, gemstone catalog and inventory, transaction ledger, recharge and withdrawal requests, secure database functions, signup trigger and Row Level Security policies.

**Important:** Run this migration once on a new/empty GEMS schema. If you have already created tables or functions manually, stop and review the existing schema before applying it.

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

The initial release has no visual admin dashboard. Admins can review requests in Supabase Table Editor and use the protected admin RPC functions while testing:

- `admin_approve_recharge(p_request_id)`
- `admin_reject_recharge(p_request_id)`
- `admin_approve_withdrawal(p_request_id)`
- `admin_reject_withdrawal(p_request_id)`
- `admin_mark_withdrawal_paid(p_request_id)`

Only mark a withdrawal paid after the payout has actually been sent.

## 5. Connect Supabase Auth to the website URL

In Supabase → **Authentication → URL Configuration**, set the Site URL to the final website address and add the corresponding sign-in/confirmation redirect URLs. The exact URL depends on the hosting method selected.

## Hosting note: GitHub + Supabase

GitHub stores the source code; Supabase provides authentication and database services. Supabase does not host this Next.js website. GitHub Pages may be usable if the app can be built as a static export, but it needs a compatible configuration and route testing. I will verify that before asking you to configure hosting. We do not need to use Vercel if we can deploy successfully with GitHub Pages.

## Important before accepting real money

This is an MVP foundation, not a finished financial service. Recharge and withdrawal requests are manual and require admin review. Before accepting customer funds or promising cash withdrawals, integrate legitimate payment and payout providers, implement admin audit controls, fraud/identity checks, customer support and clear terms/privacy disclosures, and obtain Philippine legal/accounting advice on applicable payment, consumer-protection, tax and licensing requirements. Have the SQL and economy independently reviewed before production.
