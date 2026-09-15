# SITE-TRACKER

A maintenance / incident tracking dashboard for small businesses — property managers, HOAs, and facility ops teams. Reporters submit incidents (with an optional photo); admins triage, assign, and resolve them across their organization.

**Stack:** Vite + React + TypeScript + Tailwind CSS + Supabase (Auth + Postgres + Storage). No dependencies beyond a standard Vite+React+TS+Tailwind+Supabase starter.

---

## 1. Roles

| Role | Permissions |
|---|---|
| `reporter` | Create incidents. View all incidents within their own org (read-only — cannot change status, assign, or post activity notes). |
| `admin` | Everything a reporter can do, plus: view/filter all incidents in their org, change status, assign incidents to any org member, and post activity log notes. |
| `superadmin` | Same as admin, but across **all** organizations. |

Row Level Security (RLS) enforces these boundaries at the database level — org data is isolated by Postgres policy, not just application logic.

---

## 2. How signup works (read this before onboarding real users)

SiteTrack uses a **self-serve signup model**, matching how most small-business SaaS tools work (think Slack/Asana-style "create your workspace" flow):

- **"Setting up a new organization"** at signup creates a brand-new `organizations` row and makes that user its `admin`.
- **"Joining an existing organization"** at signup lets a user pick an org from a dropdown and always joins as a `reporter`.

There is intentionally **no free-choice role picker at signup** — allowing a new user to select their own role (e.g. `admin`) would be a privilege-escalation hole. To promote a `reporter` to `admin`, an existing admin currently needs to update that user's `role` column directly (e.g. via the Supabase Table Editor, or a future "manage team" screen — not built in this version).

**Trade-off to be aware of:** organization *names* are publicly readable (via RLS) so the signup dropdown can list them before a new user has an account. No incident data, profile data, or anything sensitive is exposed by this — only org names — but if that's undesirable for your deployment, switch to an invite-link/admin-provisioning flow instead and tighten the `organizations` SELECT policy.

---

## 3. Known limitations

- **Superadmin cross-org assignment:** the "Assign To" dropdown in the admin dashboard is populated from the *current admin's own org*. A superadmin viewing an incident that belongs to a different org will still only see their own org's members in that dropdown, not the incident's actual org members. Regular single-org admins are unaffected. Fix would be to fetch org members scoped to `incident.org_id` per selected incident rather than the logged-in admin's org.
- **No role-management UI:** promoting a reporter to admin, or moving a user between orgs, currently requires direct database access (Supabase Table Editor or SQL). Consider this a v1 gap if you're handing this to end customers.
- **No email invite flow:** joining an org requires knowing its name from a public dropdown, not a private invite link/token. Fine for an internal or trusted-customer rollout; revisit before public self-serve growth.
- **Category list is a fixed dropdown** (`Plumbing`, `Electrical`, `HVAC`, etc., plus "Other" with free text) rather than an org-configurable list. Easy to extend later with a `categories` table if needed.

---

## 4. Project setup

### 4.1 Prerequisites

- Node.js 18+
- A Supabase project (free tier is fine) — create one at [supabase.com](https://supabase.com)

### 4.2 Clone and install

```bash
git clone <your-repo-url>
cd sitetrack
npm install
```

### 4.3 Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase project's URL and anon key (found in **Supabase Dashboard → Project Settings → API**):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

`.env.local` is git-ignored — never commit real keys.

### 4.4 Database setup

Go to **Supabase Dashboard → SQL Editor → New Query**, paste the full script in **Section 5 below**, and run it. This creates all tables, enables RLS, and sets up every policy in one pass.

### 4.5 Storage bucket setup

The photo-upload feature needs a **private** Storage bucket:

1. Go to **Supabase Dashboard → Storage → New bucket**
2. Name it exactly: `incident-photos`
3. Leave **Public bucket** turned **OFF** (it must stay private — the app generates short-lived signed URLs to display photos, matching the RLS policies already created by the SQL script)

### 4.6 Auth settings

By default, Supabase requires email confirmation before a session is created. Decide based on your rollout:

- **Fastest for internal testing:** Supabase Dashboard → Authentication → Providers → Email → turn OFF "Confirm email". Users get a session immediately on signup.
- **Production-appropriate:** leave email confirmation ON. The app already handles this — after signup it shows "Check your email to confirm your account" and the user completes org setup/joining on their first login after confirming.

### 4.7 Run locally

```bash
npm run dev
```

Visit the printed local URL (default `http://localhost:5173`).

### 4.8 Build for production

```bash
npm run build
npm run preview   # optional local preview of the production build
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, etc.), setting the same two `VITE_SUPABASE_*` environment variables in your host's dashboard.

---

## 5. Full SQL schema + RLS (run once, in order)

```sql
-- =========================================================
-- SITETRACK — FULL SCHEMA + RLS (run once on a fresh project)
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

create index if not exists idx_profiles_org on profiles(org_id);
create index if not exists idx_locations_org on locations(org_id);
create index if not exists idx_incidents_org on incidents(org_id);
create index if not exists idx_incidents_location on incidents(location_id);
create index if not exists idx_incidents_reported_by on incidents(reported_by);
create index if not exists idx_incidents_assigned_to on incidents(assigned_to);
create index if not exists idx_incidents_status on incidents(status);
create index if not exists idx_incident_updates_incident on incident_updates(incident_id);

-- ---------------------------------------------------------
-- HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion
-- on the profiles table when policies check "my own role/org")
-- ---------------------------------------------------------

create or replace function public.my_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.is_admin_or_super()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from profiles where id = auth.uid()) in ('admin','superadmin'), false)
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from profiles where id = auth.uid()) = 'superadmin', false)
$$;

-- ---------------------------------------------------------
-- ENABLE RLS
-- ---------------------------------------------------------

alter table organizations     enable row level security;
alter table profiles          enable row level security;
alter table locations         enable row level security;
alter table incidents         enable row level security;
alter table incident_updates  enable row level security;

-- ---------------------------------------------------------
-- ORGANIZATIONS POLICIES
-- ---------------------------------------------------------

-- Org id + name are publicly listable so the signup dropdown can show
-- orgs to join before a new user has an account. No other org table
-- exposes data this broadly.
drop policy if exists "org: public can list names for signup" on organizations;
create policy "org: public can list names for signup"
on organizations for select
using (true);

drop policy if exists "org: superadmin write" on organizations;
create policy "org: superadmin write"
on organizations for all
using (is_superadmin())
with check (is_superadmin());

-- ---------------------------------------------------------
-- PROFILES POLICIES
-- ---------------------------------------------------------

drop policy if exists "profiles: select same org or superadmin" on profiles;
create policy "profiles: select same org or superadmin"
on profiles for select
using (
  org_id = my_org_id() or is_superadmin() or id = auth.uid()
);

-- Self-serve signup can ONLY insert a 'reporter' profile — becoming an
-- 'admin' happens exclusively via the RPC below (new org creation).
drop policy if exists "profiles: insert self" on profiles;
drop policy if exists "profiles: insert self as reporter" on profiles;
create policy "profiles: insert self as reporter"
on profiles for insert
with check (id = auth.uid() and role = 'reporter');

drop policy if exists "profiles: update self or admin in org" on profiles;
create policy "profiles: update self or admin in org"
on profiles for update
using (
  id = auth.uid()
  or (is_admin_or_super() and org_id = my_org_id())
  or is_superadmin()
)
with check (
  id = auth.uid()
  or (is_admin_or_super() and org_id = my_org_id())
  or is_superadmin()
);

-- ---------------------------------------------------------
-- LOCATIONS POLICIES
-- ---------------------------------------------------------

drop policy if exists "locations: select same org or superadmin" on locations;
create policy "locations: select same org or superadmin"
on locations for select
using (org_id = my_org_id() or is_superadmin());

drop policy if exists "locations: admin write" on locations;
create policy "locations: admin write"
on locations for all
using (
  (is_admin_or_super() and org_id = my_org_id()) or is_superadmin()
)
with check (
  (is_admin_or_super() and org_id = my_org_id()) or is_superadmin()
);

-- ---------------------------------------------------------
-- INCIDENTS POLICIES
-- ---------------------------------------------------------

drop policy if exists "incidents: select org scoped" on incidents;
create policy "incidents: select org scoped"
on incidents for select
using (
  org_id = my_org_id() or is_superadmin()
);

drop policy if exists "incidents: insert own org self reported" on incidents;
create policy "incidents: insert own org self reported"
on incidents for insert
with check (
  org_id = my_org_id()
  and reported_by = auth.uid()
);

-- Reporters are read-only, including on their own incidents — status
-- and assignment changes are admin-only.
drop policy if exists "incidents: update admin only" on incidents;
create policy "incidents: update admin only"
on incidents for update
using (
  (is_admin_or_super() and org_id = my_org_id()) or is_superadmin()
)
with check (
  (is_admin_or_super() and org_id = my_org_id()) or is_superadmin()
);

drop policy if exists "incidents: delete superadmin only" on incidents;
create policy "incidents: delete superadmin only"
on incidents for delete
using (is_superadmin());

-- ---------------------------------------------------------
-- INCIDENT_UPDATES POLICIES
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

-- Reporters are read-only on the activity log — only admins/superadmins
-- can post notes.
drop policy if exists "incident_updates: insert admin only" on incident_updates;
create policy "incident_updates: insert admin only"
on incident_updates for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from incidents i
    where i.id = incident_updates.incident_id
      and (
        (is_admin_or_super() and i.org_id = my_org_id())
        or is_superadmin()
      )
  )
);

-- ---------------------------------------------------------
-- SELF-SERVE SIGNUP RPC
-- Lets a brand-new user create an org AND become its admin in one
-- atomic, privileged step. Safe because it only ever:
--   - creates a brand-new org
--   - assigns 'admin' role to the CALLING user only
--   - refuses to run if the calling user already has a profile
-- ---------------------------------------------------------

create or replace function public.create_organization_and_admin_profile(
  org_name text,
  admin_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
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

-- ---------------------------------------------------------
-- STORAGE POLICIES (incident photos)
-- Run this AFTER creating the "incident-photos" bucket via
-- Dashboard -> Storage -> New bucket (keep it PRIVATE, not public).
-- Expected object path convention: {org_id}/{incident_id}/{filename}
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
  and (
    (storage.foldername(name))[1] = my_org_id()::text
    or is_superadmin()
  )
);
```

---

## 6. Seeding your first org's locations

After your first admin account exists (via "Setting up a new organization" at signup), add at least one row to `locations` so reporters have somewhere to file incidents against. Easiest path for now: **Supabase Dashboard → Table Editor → locations → Insert row**, setting `org_id` to your new org's id (find it in the `organizations` table or your own `profiles` row).

A "Manage Locations" admin screen isn't built in this version — worth adding if this becomes a real product.

---

## 7. Project structure

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
    │   │   └── SignupPage.tsx
    │   ├── reporter/
    │   │   ├── ReporterView.tsx
    │   │   ├── NewIncidentForm.tsx
    │   │   └── MyIncidentsList.tsx
    │   └── admin/
    │       ├── AdminDashboard.tsx
    │       ├── IncidentFilters.tsx
    │       ├── IncidentTable.tsx
    │       ├── IncidentDetailPanel.tsx
    │       └── ActivityLog.tsx
```

---

## 8. Manually testing the RLS boundaries

Before shipping, verify org isolation actually holds:

1. Create two orgs (sign up twice with "Setting up a new organization", using two different emails).
2. As Org A's admin, confirm you cannot see Org B's incidents/locations anywhere in the UI.
3. In Supabase Dashboard → SQL Editor, try `select * from incidents;` while impersonating a non-superadmin role (or just trust the policies — they're enforced regardless of client) to confirm cross-org rows never leak.
4. Confirm a `reporter` account cannot change an incident's status or assignee (the UI won't show those controls for reporters at all, since only `ReporterView`/`AdminDashboard` are role-routed — but also verify directly via the API/SQL if you want defense-in-depth confidence).
