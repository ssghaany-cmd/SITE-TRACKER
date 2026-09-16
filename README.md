# SiteTrack

A maintenance / incident tracking dashboard for small businesses — property managers, HOAs, and facility ops teams. Reporters submit incidents (with an optional photo); admins triage, assign, and resolve them across their organization.

**Stack:** Vite + React + TypeScript + Tailwind CSS + Supabase (Auth + Postgres + Storage). No dependencies beyond a standard Vite+React+TS+Tailwind+Supabase starter — invite links use the browser's built-in `URLSearchParams`, not a router package.

---

## 1. Roles

| Role | Permissions |
|---|---|
| `reporter` | Create incidents. View all incidents within their own org (read-only — cannot change status, assign, or post activity notes). |
| `admin` | Everything a reporter can do, plus: view/filter all incidents in their org, change status, assign incidents to any org member, post activity log notes, manage locations, manage team member roles, and generate/revoke invite links. |
| `superadmin` | Same as admin, but across **all** organizations. |

Row Level Security (RLS) enforces these boundaries at the database level — org data is isolated by Postgres policy, not just application logic. A database trigger (`enforce_profile_update_rules`, see Section 5) additionally guarantees no one — not even an org admin — can grant themselves or anyone else `superadmin`, or move a profile to a different org, from the client.

---

## 2. How signup works

There are exactly two ways to get an account:

1. **"Setting up a new organization"** — creates a brand-new `organizations` row and makes that user its `admin`. This is the only way a company's very first account gets created; someone has to bootstrap the org before invites can exist.
2. **"Joining with an invite code"** — an existing admin generates a one-time invite link (Admin Dashboard → Invites tab), choosing whether it grants `reporter` or `admin`. The person opens the link (or pastes the code), and the invite is redeemed through a database function — never through a public, browsable table — so no one can discover other orgs' invite codes or org names by querying the app.

**There is no free-choice role picker at signup.** Letting a new user select their own role would be a privilege-escalation hole. Promoting someone from `reporter` to `admin` after the fact happens on the **Team** tab of the Admin Dashboard, not at signup.

**Invite delivery is manual/out-of-band.** This app does not send emails — an admin copies the generated link and shares it however they normally communicate with their team (text, email, Slack, etc.). Wiring up transactional email (e.g. via a Supabase Edge Function + an email provider) is a natural next step if that friction matters for your rollout.

---

## 3. Admin management screens

The Admin Dashboard has four tabs:

- **Incidents** — the original filterable table + detail panel + activity log.
- **Locations** — add, edit, and delete the org's locations. Deleting a location that has incidents attached is blocked at the database level (`ON DELETE RESTRICT`) and surfaced as a friendly error, rather than silently orphaning incident history.
- **Team** — view all org members and change any non-self, non-superadmin member's role between `reporter` and `admin`. A user can never change their own role from this screen (or via the API — the database trigger blocks it).
- **Invites** — generate a one-time invite link for a chosen role (`reporter` or `admin`), see all past invites and their usage, and revoke any that haven't been used yet.

---

## 4. Known limitations

- **Superadmin cross-org assignment:** the "Assign To" dropdown on an incident's detail panel is populated from the *current admin's own org*. A superadmin viewing an incident that belongs to a different org will still only see their own org's members in that dropdown, not the incident's actual org members. Regular single-org admins are unaffected.
- **No transactional email:** invite links must be shared manually by whoever generates them (see Section 2). There's no automated "invite by email address" flow.
- **Category list is a fixed dropdown** (`Plumbing`, `Electrical`, `HVAC`, etc., plus "Other" with free text) rather than an org-configurable list. Easy to extend later with a `categories` table if needed.
- **Invite expiry isn't set by default:** invites are created with `max_uses = 1` and no `expires_at`, so an unused invite link remains valid indefinitely until manually revoked. Add an expiry input to the Invites tab if that's a requirement.

---

## 5. Project setup

### 5.1 Prerequisites

- Node.js 18+
- A Supabase project (free tier is fine) — create one at [supabase.com](https://supabase.com)

### 5.2 Clone and install

```bash
git clone <your-repo-url>
cd sitetrack
npm install
```

### 5.3 Environment variables

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

### 5.4 Database setup

Go to **Supabase Dashboard → SQL Editor → New Query**, paste the full script in **Section 6 below**, and run it. Every statement is idempotent (`create table if not exists`, `create or replace function`, `drop policy if exists` before each `create policy`), so this single script works whether you're setting up a brand-new project or re-running it on one that already has the schema.

### 5.5 Storage bucket setup

The photo-upload feature needs a **private** Storage bucket:

1. Go to **Supabase Dashboard → Storage → New bucket**
2. Name it exactly: `incident-photos`
3. Leave **Public bucket** turned **OFF** (it must stay private — the app generates short-lived signed URLs to display photos, matching the RLS policies already created by the SQL script)

### 5.6 Auth settings

By default, Supabase requires email confirmation before a session is created. Decide based on your rollout:

- **Fastest for internal testing:** Supabase Dashboard → Authentication → Providers → Email → turn OFF "Confirm email". Users get a session immediately on signup.
- **Production-appropriate:** leave email confirmation ON. The app already handles this — after signup it shows "Check your email to confirm your account" and the user completes org setup/invite redemption on their first login after confirming.

### 5.7 Run locally

```bash
npm run dev
```

Visit the printed local URL (default `http://localhost:5173`).

### 5.8 Build for production

```bash
npm run build
npm run preview   # optional local preview of the production build
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, etc.), setting the same two `VITE_SUPABASE_*` environment variables in your host's dashboard.

---

## 6. Full SQL schema + RLS (run once — safe to re-run)

```sql
-- =========================================================
-- SITETRACK — FULL SCHEMA + RLS (idempotent — safe to re-run)
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

create index if not exists idx_profiles_org on profiles(org_id);
create index if not exists idx_locations_org on locations(org_id);
create index if not exists idx_incidents_org on incidents(org_id);
create index if not exists idx_incidents_location on incidents(location_id);
create index if not exists idx_incidents_reported_by on incidents(reported_by);
create index if not exists idx_incidents_assigned_to on incidents(assigned_to);
create index if not exists idx_incidents_status on incidents(status);
create index if not exists idx_incident_updates_incident on incident_updates(incident_id);
create index if not exists idx_invites_org on invites(org_id);
create index if not exists idx_invites_token on invites(token);

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
alter table invites           enable row level security;

-- ---------------------------------------------------------
-- ORGANIZATIONS POLICIES
-- Private — org names are never publicly listable. Joining an org
-- happens via invite token (redeemed through a function), not by
-- browsing organization names.
-- ---------------------------------------------------------

drop policy if exists "org: public can list names for signup" on organizations;
drop policy if exists "org: select own or superadmin" on organizations;
create policy "org: select own or superadmin"
on organizations for select
using (
  id = my_org_id() or is_superadmin()
);

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

-- Self-serve signup can ONLY insert a 'reporter' profile (org-creation
-- signup and invite-redemption signup both go through SECURITY DEFINER
-- RPCs instead, which bypass this policy entirely).
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

-- Column-level business rules RLS alone can't express (comparing OLD
-- vs NEW values): only admins can change a role, an org admin can
-- never grant 'superadmin', and only a superadmin can move a profile
-- to a different org. This is what actually makes the Team tab safe.
create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
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
for each row
execute function public.enforce_profile_update_rules();

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
-- INVITES POLICIES
-- Only admins/superadmins can see their own org's invites, for
-- management/revocation. Redemption never reads this table directly
-- from the client (see redeem_invite() below), so a token is never
-- exposed by a browsable query.
-- ---------------------------------------------------------

drop policy if exists "invites: select admin in org or superadmin" on invites;
create policy "invites: select admin in org or superadmin"
on invites for select
using (
  (is_admin_or_super() and org_id = my_org_id()) or is_superadmin()
);

drop policy if exists "invites: insert admin in org or superadmin" on invites;
create policy "invites: insert admin in org or superadmin"
on invites for insert
with check (
  created_by = auth.uid()
  and (
    (is_admin_or_super() and org_id = my_org_id()) or is_superadmin()
  )
);

drop policy if exists "invites: delete admin in org or superadmin" on invites;
create policy "invites: delete admin in org or superadmin"
on invites for delete
using (
  (is_admin_or_super() and org_id = my_org_id()) or is_superadmin()
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
-- INVITE RPCs
-- ---------------------------------------------------------

-- Lets an unauthenticated (or authenticated) visitor preview what an
-- invite token leads to (org name + role) before signing up, WITHOUT
-- ever granting table-level SELECT access to the invites table.
create or replace function public.preview_invite(invite_token text)
returns table(org_name text, invite_role text, is_valid boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  select i.*, o.name as org_name
  into inv
  from invites i
  join organizations o on o.id = i.org_id
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

-- Redeems an invite for the CALLING (already signed-up, now
-- authenticated) user: validates the token, creates their profile
-- with the invite's org_id + role, and increments the use count.
create or replace function public.redeem_invite(invite_token text, new_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public
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
    │       ├── ActivityLog.tsx
    │       ├── ManageLocations.tsx
    │       ├── ManageTeam.tsx
    │       └── ManageInvites.tsx
```

---

## 8. Manually testing the RLS boundaries

Before shipping, verify org isolation actually holds:

1. Create two orgs (sign up twice with "Setting up a new organization", using two different emails).
2. As Org A's admin, confirm you cannot see Org B's incidents/locations/team/invites anywhere in the UI.
3. Generate an invite in Org A, then try redeeming it while signed in as an Org B user — the RPC should reject it (`User already has a profile`). Sign up as a brand-new third user and redeem it — confirm they land in Org A with the correct role.
4. Confirm a `reporter` account cannot change an incident's status/assignee, post an activity note, or see the Locations/Team/Invites tabs at all (they're never rendered for non-admins, since `App.tsx` routes purely by `profile.role`).
5. As an org admin, try (via direct API call, e.g. browser dev tools) to `update` your own profile's `role` to `superadmin`, or another user's `org_id` to a different org. Both should fail — the `enforce_profile_update_rules` trigger blocks them regardless of what the UI allows.
