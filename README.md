# SiteTrack

A maintenance / incident tracking dashboard for small businesses — property managers, HOAs, and facility ops teams. Reporters submit incidents (with an optional photo); admins triage, assign, notify, and resolve them across their organization; the whole thing can run as a paid subscription product.

**Stack:** Vite + React + TypeScript + Tailwind CSS + Supabase (Auth + Postgres + Storage + Edge Functions). No frontend dependencies beyond a standard Vite+React+TS+Tailwind+Supabase starter. Email is sent via **Resend**; billing is handled via **Stripe**. Both require their own free/paid accounts (see Section 7).

---

## 1. Roles

| Role | Permissions |
|---|---|
| `reporter` | Create incidents. View all incidents within their own org (read-only — cannot change status, assign, or post activity notes). |
| `admin` | Everything a reporter can do, plus: view/filter all incidents in their org, change status, assign incidents to a team member or external vendor, post activity log notes, manage locations, manage vendors, manage team member roles, generate/revoke invite links, view reports, and manage billing. |
| `superadmin` | Same as admin, but across **all** organizations. |

Row Level Security (RLS) enforces these boundaries at the database level. A trigger (`enforce_profile_update_rules`) additionally guarantees no one — not even an org admin — can grant themselves or anyone else `superadmin`, or move a profile to a different org, from the client.

---

## 2. Signup, login, and password reset

**Creating an account** has two paths, chosen via a dropdown at signup:
1. **"Setting up a new organization"** — creates a brand-new org and makes that user its `admin`. This is the only way a company's first account gets created.
2. **"Joining with an invite code"** — an admin generates a one-time invite (Admin Dashboard → Invites tab), choosing `reporter` or `admin`, and either shares the link manually or has it emailed directly to the invitee. Redemption happens through a database function, never a public/browsable table, so no org names or tokens are ever exposed to strangers.

There is intentionally **no free-choice role picker at signup** — that would be a privilege-escalation hole. Promoting a `reporter` to `admin` happens on the **Team** tab after the fact.

**Forgot password:** the login screen has a "Forgot password?" link. It emails a reset link via Supabase's built-in mechanism (no Resend/Stripe involved — this is separate from the notification system). Clicking the link brings the user back into the app, which automatically detects the recovery token and shows a "set new password" screen before letting them into their dashboard.

**Email confirmation:** by default Supabase requires confirming your email before a session exists. If left on, org-creation/invite-redemption can't complete until after confirming (see Known Limitations). For a straightforward internal rollout, turn this off in **Authentication → Providers → Email → "Confirm email"**.

---

## 3. Admin Dashboard tabs

- **Incidents** — filterable table (status/priority/location) + detail panel with status, internal assignee, and vendor assignment + embedded activity log.
- **Reports** — total incident count, average hours-to-resolution, and simple bar charts of incidents by category and by location (built with plain CSS bars, no charting library).
- **Locations** — add/edit/delete the org's buildings/sites. Deleting a location with incidents attached is blocked at the database level and shown as a friendly error.
- **Vendors** — maintain a list of external contractors (name, contact, phone, email, specialty) that incidents can be assigned to alongside or instead of an internal team member.
- **Team** — view all org members, promote/demote between `reporter` and `admin`. A user can never change their own role (enforced by both the UI and a database trigger).
- **Invites** — generate a one-time invite for a chosen role, optionally emailing it directly via Resend; view and revoke past invites.
- **Billing** — shows current subscription status; "Subscribe" starts a Stripe Checkout session, "Manage Billing" opens Stripe's hosted Customer Portal.

---

## 4. Notifications (email)

Two independent email mechanisms:

1. **Invite emails** — triggered directly by the app (`send-invite-email` Edge Function) when an admin fills in a recipient address on the Invites tab. No extra Supabase configuration beyond the function + its secret.
2. **Status-change / assignment / new-note emails** — triggered by **Database Webhooks** (Supabase feature) calling the `notify-email` Edge Function whenever `incidents` is updated or a new `incident_updates` row is inserted. This requires the `pg_net` Postgres extension to be enabled on the project (Database → Extensions) — some Supabase projects have hit a provisioning bug here (see Known Limitations).

---

## 5. Billing

Stripe Checkout + Customer Portal, wired through three Edge Functions (`create-checkout-session`, `create-portal-session`, `stripe-webhook`). The `subscriptions` table is **never writable from the client** — only the webhook function (using the service role key) can update it, so billing status can't be tampered with from the app or API.

---

## 6. Known limitations

- **Superadmin cross-org assignment:** the internal "Assigned To" dropdown is populated from the *current admin's own org*; a superadmin viewing another org's incident won't see that org's actual members there.
- **Email confirmation + org creation don't mix well yet:** if Supabase's "Confirm email" is ON, a user must have an active session for the org-creation/invite-redemption RPC to run. There's no "resume setup after confirming" flow yet — turning confirmation off (see Section 2) is the practical workaround for now.
- **Database Webhooks provisioning bug:** on some Supabase projects, creating a webhook fails with `schema "supabase_functions" does not exist` even after enabling `pg_net`. This is a known Supabase-side issue, not something fixable from the Dashboard — if hit, either contact Supabase support to have the schema reprovisioned, or skip automated status-change emails (invite emails are unaffected, since they don't use Database Webhooks at all).
- **Invite expiry isn't set by default:** invites have `max_uses = 1` and no `expires_at`, so an unused link stays valid until manually revoked.
- **Category list is a fixed dropdown**, not org-configurable.
- **No native mobile app** — this is a mobile-friendly website, not an App Store/Play Store app (a native app would be a separate rewrite, e.g. React Native).

---

## 7. Project setup

### 7.1 Prerequisites

- Node.js 18+
- A Supabase project (free tier is fine)
- A Resend account (free tier) — for email
- A Stripe account — for billing (skip if you don't need billing yet)

### 7.2 Clone and install

```bash
git clone <your-repo-url>
cd sitetrack
npm install
```

### 7.3 Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase project's URL and anon key (Supabase Dashboard → Project Settings → API):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

`.env.local` is git-ignored — never commit real keys.

### 7.4 Database setup

Run the full SQL script in **Section 8** in Supabase Dashboard → SQL Editor. Every statement is idempotent — safe to re-run on an existing project.

### 7.5 Storage bucket

Create a **private** bucket named exactly `incident-photos` (Dashboard → Storage → New bucket, Public toggle OFF). The SQL script's storage policies target this exact name.

### 7.6 Auth settings

- **Authentication → Providers → Email → "Confirm email"** — turn OFF for a simple internal rollout (see Section 6 for why).
- **Authentication → URL Configuration → Redirect URLs** — add your deployed app's URL (needed for the password reset flow to work).

### 7.7 Edge Functions

Deploy each of the 5 functions in **Section 9** via **Supabase Dashboard → Edge Functions → Create a new function**. **Type the exact name given** — Supabase auto-suggests a random placeholder name; if you don't overwrite it, your function calls (`supabase.functions.invoke('create-checkout-session')`, etc.) will fail to find it:

- `notify-email`
- `send-invite-email`
- `create-checkout-session`
- `create-portal-session`
- `stripe-webhook` — additionally, turn **OFF "Verify JWT"** for this one specifically (Stripe can't supply a Supabase user token)

### 7.8 Secrets

Secrets are set **once, project-wide** (Edge Functions → Secrets tab), not per-function — every function can read any of them. Do not use names starting with `SUPABASE_` for your own secrets other than the ones below; that prefix is reserved, and `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are already provided automatically — you don't add those yourself.

| Secret name | Value | Used by |
|---|---|---|
| `RESEND_API_KEY` | From resend.com | `notify-email`, `send-invite-email` |
| `NOTIFY_FROM_EMAIL` | e.g. `SiteTrack <onboarding@resend.dev>` (optional — defaults to Resend's test sender) | `notify-email`, `send-invite-email` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | `create-checkout-session`, `create-portal-session`, `stripe-webhook` |
| `STRIPE_PRICE_ID` | The Price ID of your subscription plan | `create-checkout-session` |
| `STRIPE_WEBHOOK_SECRET` | Given by Stripe when you register the webhook endpoint | `stripe-webhook` |
| `APP_URL` | Your deployed app's URL, e.g. `https://your-app.vercel.app` | `create-checkout-session`, `create-portal-session` |

### 7.9 Database Webhooks (for automatic status/assignment emails)

**Database → Extensions** → enable `pg_net` first (provisions a schema the webhooks feature needs). Then **Database → Webhooks → Create a new webhook**, twice:

1. Table `incidents`, event **UPDATE**, target: Edge Function `notify-email`
2. Table `incident_updates`, event **INSERT**, target: Edge Function `notify-email`

If this fails with `schema "supabase_functions" does not exist` even after enabling `pg_net`, see Section 6 — it's a known Supabase-side bug on some projects, not a config error.

### 7.10 Stripe webhook registration

After deploying `stripe-webhook`, copy its URL from the Dashboard and register it in **Stripe Dashboard → Developers → Webhooks → Add endpoint**, listening for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Stripe will then give you the signing secret for `STRIPE_WEBHOOK_SECRET`.

### 7.11 Run locally / build

```bash
npm run dev        # local dev server
npm run build       # production build
npm run preview     # preview the production build locally
```

Deploy `dist/` to any static host (Vercel, Netlify, etc.), setting the same two `VITE_SUPABASE_*` env vars there too.

---

## 8. Full SQL schema + RLS (run once — safe to re-run)

```sql
-- =========================================================
-- SITETRACK — FULL SCHEMA + RLS (idempotent — safe to re-run)
-- Covers: core tables, invites, vendors, subscriptions/billing.
-- Supabase Dashboard -> SQL Editor -> New Query -> paste all -> Run
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  org_id              uuid not null references organizations(id) on delete cascade,
  role                text not null check (role in ('reporter','admin','superadmin')),
  full_name           text not null default '',
  assigned_locations  text[] not null default '{}',
  created_at          timestamptz not null default now()
);

create table if not exists locations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  address     text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists incidents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  location_id   uuid not null references locations(id) on delete restrict,
  reported_by   uuid not null references profiles(id) on delete restrict,
  category      text not null,
  description   text not null,
  status        text not null default 'open' check (status in ('open','in_progress','resolved')),
  priority      text not null default 'medium' check (priority in ('low','medium','high')),
  photo_url     text,
  assigned_to   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create table if not exists incident_updates (
  id            uuid primary key default gen_random_uuid(),
  incident_id   uuid not null references incidents(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete restrict,
  note          text not null,
  created_at    timestamptz not null default now()
);

create table if not exists invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  role        text not null check (role in ('reporter','admin')),
  token       text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_by  uuid not null references profiles(id) on delete restrict,
  max_uses    integer not null default 1,
  uses        integer not null default 0,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists vendors (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  contact_name  text not null default '',
  phone         text not null default '',
  email         text not null default '',
  specialty     text not null default '',
  created_at    timestamptz not null default now()
);

alter table incidents add column if not exists vendor_id uuid references vendors(id) on delete set null;

create table if not exists subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null unique references organizations(id) on delete cascade,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  status                  text not null default 'trialing'
                            check (status in ('trialing','active','past_due','canceled','incomplete')),
  plan                    text not null default 'starter',
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_profiles_org on profiles(org_id);
create index if not exists idx_locations_org on locations(org_id);
create index if not exists idx_incidents_org on incidents(org_id);
create index if not exists idx_incidents_location on incidents(location_id);
create index if not exists idx_incidents_reported_by on incidents(reported_by);
create index if not exists idx_incidents_assigned_to on incidents(assigned_to);
create index if not exists idx_incidents_status on incidents(status);
create index if not exists idx_incidents_vendor on incidents(vendor_id);
create index if not exists idx_incident_updates_incident on incident_updates(incident_id);
create index if not exists idx_invites_org on invites(org_id);
create index if not exists idx_invites_token on invites(token);
create index if not exists idx_vendors_org on vendors(org_id);

-- ---------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------

create or replace function public.my_org_id()
returns uuid language sql stable security definer set search_path = public
as $$ select org_id from profiles where id = auth.uid() $$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create or replace function public.is_admin_or_super()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select role from profiles where id = auth.uid()) in ('admin','superadmin'), false) $$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select role from profiles where id = auth.uid()) = 'superadmin', false) $$;

-- ---------------------------------------------------------
-- ENABLE RLS
-- ---------------------------------------------------------

alter table organizations     enable row level security;
alter table profiles          enable row level security;
alter table locations         enable row level security;
alter table incidents         enable row level security;
alter table incident_updates  enable row level security;
alter table invites           enable row level security;
alter table vendors           enable row level security;
alter table subscriptions     enable row level security;

-- ---------------------------------------------------------
-- ORGANIZATIONS
-- ---------------------------------------------------------

drop policy if exists "org: public can list names for signup" on organizations;
drop policy if exists "org: select own or superadmin" on organizations;
create policy "org: select own or superadmin"
on organizations for select
using (id = my_org_id() or is_superadmin());

drop policy if exists "org: superadmin write" on organizations;
create policy "org: superadmin write"
on organizations for all
using (is_superadmin()) with check (is_superadmin());

-- ---------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------

drop policy if exists "profiles: select same org or superadmin" on profiles;
create policy "profiles: select same org or superadmin"
on profiles for select
using (org_id = my_org_id() or is_superadmin() or id = auth.uid());

drop policy if exists "profiles: insert self" on profiles;
drop policy if exists "profiles: insert self as reporter" on profiles;
create policy "profiles: insert self as reporter"
on profiles for insert
with check (id = auth.uid() and role = 'reporter');

drop policy if exists "profiles: update self or admin in org" on profiles;
create policy "profiles: update self or admin in org"
on profiles for update
using (
  id = auth.uid() or (is_admin_or_super() and org_id = my_org_id()) or is_superadmin()
)
with check (
  id = auth.uid() or (is_admin_or_super() and org_id = my_org_id()) or is_superadmin()
);

create or replace function public.enforce_profile_update_rules()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.org_id is distinct from old.org_id and not is_superadmin() then
    raise exception 'Only a superadmin can move a profile to a different organization';
  end if;
  if new.role is distinct from old.role and not is_admin_or_super() then
    raise exception 'Only an admin can change a user''s role';
  end if;
  if new.role = 'superadmin' and old.role is distinct from new.role and not is_superadmin() then
    raise exception 'Only a superadmin can grant the superadmin role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_update_rules on profiles;
create trigger trg_enforce_profile_update_rules
before update on profiles
for each row execute function public.enforce_profile_update_rules();

-- ---------------------------------------------------------
-- LOCATIONS
-- ---------------------------------------------------------

drop policy if exists "locations: select same org or superadmin" on locations;
create policy "locations: select same org or superadmin"
on locations for select
using (org_id = my_org_id() or is_superadmin());

drop policy if exists "locations: admin write" on locations;
create policy "locations: admin write"
on locations for all
using ((is_admin_or_super() and org_id = my_org_id()) or is_superadmin())
with check ((is_admin_or_super() and org_id = my_org_id()) or is_superadmin());

-- ---------------------------------------------------------
-- INCIDENTS
-- ---------------------------------------------------------

drop policy if exists "incidents: select org scoped" on incidents;
create policy "incidents: select org scoped"
on incidents for select
using (org_id = my_org_id() or is_superadmin());

drop policy if exists "incidents: insert own org self reported" on incidents;
create policy "incidents: insert own org self reported"
on incidents for insert
with check (org_id = my_org_id() and reported_by = auth.uid());

drop policy if exists "incidents: update admin only" on incidents;
create policy "incidents: update admin only"
on incidents for update
using ((is_admin_or_super() and org_id = my_org_id()) or is_superadmin())
with check ((is_admin_or_super() and org_id = my_org_id()) or is_superadmin());

drop policy if exists "incidents: delete superadmin only" on incidents;
create policy "incidents: delete superadmin only"
on incidents for delete
using (is_superadmin());

-- ---------------------------------------------------------
-- INCIDENT_UPDATES
-- ---------------------------------------------------------

drop policy if exists "incident_updates: select via parent incident" on incident_updates;
create policy "incident_updates: select via parent incident"
on incident_updates for select
using (
  exists (
    select 1 from incidents i
    where i.id = incident_updates.incident_id
      and (i.org_id = my_org_id() or is_superadmin())
  )
);

drop policy if exists "incident_updates: insert admin only" on incident_updates;
create policy "incident_updates: insert admin only"
on incident_updates for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from incidents i
    where i.id = incident_updates.incident_id
      and ((is_admin_or_super() and i.org_id = my_org_id()) or is_superadmin())
  )
);

-- ---------------------------------------------------------
-- INVITES
-- ---------------------------------------------------------

drop policy if exists "invites: select admin in org or superadmin" on invites;
create policy "invites: select admin in org or superadmin"
on invites for select
using ((is_admin_or_super() and org_id = my_org_id()) or is_superadmin());

drop policy if exists "invites: insert admin in org or superadmin" on invites;
create policy "invites: insert admin in org or superadmin"
on invites for insert
with check (
  created_by = auth.uid()
  and ((is_admin_or_super() and org_id = my_org_id()) or is_superadmin())
);

drop policy if exists "invites: delete admin in org or superadmin" on invites;
create policy "invites: delete admin in org or superadmin"
on invites for delete
using ((is_admin_or_super() and org_id = my_org_id()) or is_superadmin());

-- ---------------------------------------------------------
-- VENDORS
-- ---------------------------------------------------------

drop policy if exists "vendors: select same org or superadmin" on vendors;
create policy "vendors: select same org or superadmin"
on vendors for select
using (org_id = my_org_id() or is_superadmin());

drop policy if exists "vendors: admin write" on vendors;
create policy "vendors: admin write"
on vendors for all
using ((is_admin_or_super() and org_id = my_org_id()) or is_superadmin())
with check ((is_admin_or_super() and org_id = my_org_id()) or is_superadmin());

-- ---------------------------------------------------------
-- SUBSCRIPTIONS
-- Read-only from the client. Writes ONLY ever happen from the
-- stripe-webhook Edge Function using the service role key.
-- ---------------------------------------------------------

drop policy if exists "subscriptions: select admin in org or superadmin" on subscriptions;
create policy "subscriptions: select admin in org or superadmin"
on subscriptions for select
using ((is_admin_or_super() and org_id = my_org_id()) or is_superadmin());

-- ---------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------

create or replace function public.create_organization_and_admin_profile(
  org_name text, admin_full_name text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_org_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'User already has a profile';
  end if;
  insert into organizations (name) values (org_name) returning id into new_org_id;
  insert into profiles (id, org_id, role, full_name, assigned_locations)
  values (auth.uid(), new_org_id, 'admin', admin_full_name, '{}');
  return new_org_id;
end;
$$;

grant execute on function public.create_organization_and_admin_profile(text, text) to authenticated;

create or replace function public.preview_invite(invite_token text)
returns table(org_name text, invite_role text, is_valid boolean)
language plpgsql security definer set search_path = public
as $$
declare
  inv record;
begin
  select i.*, o.name as org_name into inv
  from invites i join organizations o on o.id = i.org_id
  where i.token = invite_token;

  if inv is null then
    return query select null::text, null::text, false;
    return;
  end if;

  if (inv.expires_at is not null and inv.expires_at < now()) or inv.uses >= inv.max_uses then
    return query select inv.org_name, inv.role, false;
    return;
  end if;

  return query select inv.org_name, inv.role, true;
end;
$$;

grant execute on function public.preview_invite(text) to anon, authenticated;

create or replace function public.redeem_invite(invite_token text, new_full_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  inv record;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'User already has a profile';
  end if;

  select * into inv from invites where token = invite_token for update;

  if inv is null then
    raise exception 'Invalid invite code';
  end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'This invite has expired';
  end if;
  if inv.uses >= inv.max_uses then
    raise exception 'This invite has already been used';
  end if;

  insert into profiles (id, org_id, role, full_name, assigned_locations)
  values (auth.uid(), inv.org_id, inv.role, new_full_name, '{}');

  update invites set uses = uses + 1 where id = inv.id;

  return inv.org_id;
end;
$$;

grant execute on function public.redeem_invite(text, text) to authenticated;

-- ---------------------------------------------------------
-- STORAGE (incident photos)
-- Create the "incident-photos" bucket first (Dashboard -> Storage),
-- PRIVATE, before running this section.
-- ---------------------------------------------------------

drop policy if exists "incident-photos: insert own org folder" on storage.objects;
create policy "incident-photos: insert own org folder"
on storage.objects for insert
with check (
  bucket_id = 'incident-photos'
  and (storage.foldername(name))[1] = my_org_id()::text
);

drop policy if exists "incident-photos: select own org or superadmin" on storage.objects;
create policy "incident-photos: select own org or superadmin"
on storage.objects for select
using (
  bucket_id = 'incident-photos'
  and ((storage.foldername(name))[1] = my_org_id()::text or is_superadmin())
);
```

---

## 9. Edge Functions reference

All five are deployed via **Supabase Dashboard → Edge Functions** (not part of the GitHub repo — they run on Supabase's servers, not in the Vite build). Full source for each was provided during development; consult your team's copy of these files or regenerate from the specs below if lost:

| Function | Triggered by | Purpose | Needs "Verify JWT" off? |
|---|---|---|---|
| `notify-email` | Database Webhooks (`incidents` UPDATE, `incident_updates` INSERT) | Emails reporters/assignees on status change, assignment, new notes | No |
| `send-invite-email` | App (`supabase.functions.invoke`) | Emails an invite link directly to a recipient | No |
| `create-checkout-session` | App (Billing tab "Subscribe") | Starts a Stripe Checkout session | No |
| `create-portal-session` | App (Billing tab "Manage Billing") | Opens Stripe's hosted Customer Portal | No |
| `stripe-webhook` | Stripe (external) | Updates `subscriptions` on payment events | **Yes** |

See Section 7.8 for the secrets each one needs.

---

## 10. Project structure

```
sitetrack/
├── .env.example
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
├── README.md
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── types/
    │   └── database.ts
    ├── lib/
    │   └── supabaseClient.ts
    ├── contexts/
    │   └── AuthContext.tsx
    ├── hooks/
    │   ├── useIncidents.ts
    │   └── useLocations.ts
    ├── utils/
    │   ├── formatDate.ts
    │   └── storage.ts
    ├── components/
    │   ├── shared/
    │   │   ├── StatusBadge.tsx
    │   │   ├── PriorityBadge.tsx
    │   │   └── LoadingSpinner.tsx
    │   ├── layout/
    │   │   ├── Header.tsx
    │   │   └── StatsHeader.tsx
    │   ├── auth/
    │   │   ├── LoginPage.tsx
    │   │   ├── SignupPage.tsx
    │   │   └── ResetPasswordPage.tsx
    │   ├── reporter/
    │   │   ├── ReporterView.tsx
    │   │   ├── NewIncidentForm.tsx
    │   │   └── MyIncidentsList.tsx
    │   └── admin/
    │       ├── AdminDashboard.tsx
    │       ├── IncidentFilters.tsx
    │       ├── IncidentTable.tsx
    │       ├── IncidentDetailPanel.tsx
    │       ├── ActivityLog.tsx
    │       ├── ManageLocations.tsx
    │       ├── ManageTeam.tsx
    │       ├── ManageInvites.tsx
    │       ├── ManageVendors.tsx
    │       ├── ManageBilling.tsx
    │       └── ReportsAnalytics.tsx
```

(Edge Functions live in Supabase, not this repo — see Section 9.)

---

## 11. Manually testing before shipping

1. **Org isolation:** create two orgs; confirm Org A's admin never sees Org B's incidents/locations/vendors/team/invites/billing.
2. **Invite flow:** generate an invite in Org A, redeem it as a new user, confirm correct org + role.
3. **Role escalation attempts:** as an org admin, try (via dev tools) updating your own `role` to `superadmin` or another user's `org_id` — both should fail via the trigger regardless of what the UI allows.
4. **Password reset:** log out, use "Forgot password?", click the emailed link, confirm you land on the new-password screen and can log in afterward with the new password.
5. **Invite email:** generate an invite with your own email in the "Email it to" field, confirm it arrives (check spam).
6. **Billing:** subscribe via Stripe test mode, confirm `subscriptions` updates to `active`; cancel via the portal, confirm it updates to `canceled`.
7. **Photo upload + signed URL display:** submit an incident with a photo as a reporter, confirm an admin can view it in the detail panel.
