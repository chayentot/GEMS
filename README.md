# GEMS Mining — GitHub-ready starter

A Next.js + Supabase starter for the GEMS gemstone-mining platform.

## Included

- Email/password registration and login through Supabase Auth
- Player dashboard and wallet display
- Starter Garnet on new account creation
- Database-side gemstone purchase
- Database-side 24-hour mining cycles and collection
- Manual recharge request (0% platform fee; admin approval required)
- Withdrawal request (6% fee, 150 GEMS minimum; reserves GEMS pending review)
- Wallet transaction ledger
- Row Level Security (RLS) policies
- Admin approval SQL functions

## Economy rules included

- Accounting conversion: 1 GEMS = ₱1
- Recharge fee: 0%
- Conversion fee setting: 5% (conversion itself is intentionally not enabled until the diamond/GEMS conversion ratio and direction are specified)
- Withdrawal fee: 6%
- Minimum withdrawal: 150 GEMS
- Mining cycle: maximum 24 hours
- Starter Garnet: 1 GEMS unlock price for additional Garnet purchases; one starter Garnet is granted at signup

The sample Garnet reward is `0.01 GEMS/hour`. Change this in the `gemstones` table after deciding the official mining rates for each gemstone and level.

## 1. Create the Supabase project

1. Create a project at https://supabase.com/dashboard.
2. Open **Project Settings → API**.
3. Copy the Project URL and the publishable key (or legacy anon key).
4. In **SQL Editor**, open a new query.
5. Paste and run `supabase/migrations/001_gems_schema.sql`.

Do not expose the Supabase service-role/secret key in frontend code or GitHub.

## 2. Configure the project locally

Install Node.js LTS from https://nodejs.org/.

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Then run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 3. Create your first admin

1. Register your own account from `/login`.
2. In Supabase → SQL Editor, run this command, replacing the email:

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'YOUR-ADMIN-EMAIL'
on conflict do nothing;
```

Admin functions are protected by `public.is_admin()`. This starter does not yet include a visual admin dashboard; use the Supabase SQL editor to review requests and invoke the admin RPC functions while testing.

## 4. Push to GitHub

Create an empty repository named `gems-mining`, then from this folder run:

```bash
git init
git add .
git commit -m "Initial GEMS Mining website"
git branch -M main
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/gems-mining.git
git push -u origin main
```

Never commit `.env.local`.

## 5. Deploy to Vercel

1. Sign in to https://vercel.com using GitHub.
2. Add New → Project → import `gems-mining`.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Environment Variables.
4. Deploy.

## 6. Supabase Auth URL configuration

After Vercel gives you a deployment URL:

1. Supabase → Authentication → URL Configuration.
2. Set Site URL to your Vercel domain.
3. Add `https://YOUR-VERCEL-DOMAIN/**` to Redirect URLs if needed.
4. Test registration, email confirmation and sign-in.

## Important production checklist

This is a functional MVP foundation, not a finished regulated-money platform. Before accepting real money or enabling cash withdrawals:

- Choose and integrate a legitimate payment provider and payout provider.
- Add a secure admin dashboard with audit logs and role management.
- Add identity, fraud, duplicate-payment and abuse controls.
- Add customer support, dispute handling, terms, privacy notice and clear fee disclosures.
- Obtain Philippine legal/accounting advice on the business model, token design, payments, consumer protection, tax and any applicable licensing.
- Load test and security review the database functions and RLS policies.
- Decide the full gemstone catalog, mining reward per hour, upgrade costs and diamond conversion ratio.

### Important implementation notes

- The `diamonds_balance` field is present because the initial account model included Diamonds, but conversion is not enabled until you provide the exact conversion direction and rate.
- Recharge requests are manual. A request does not credit GEMS until an admin approves it.
- Withdrawal requests reserve GEMS immediately. If rejected, the database function refunds the reserved amount. An approved request must be marked paid only after the payout is actually sent.
- Payout details are sensitive. Limit admin access and define a retention policy before production.
- The starter UI shows the player's own records. Admin review currently uses Supabase SQL functions; a proper admin interface is a follow-up build.
