-- Bloom database schema
-- PostgreSQL 13+
-- The application connects as a restricted role (bloom_app); migrations run as
-- the database owner. Row Level Security is enforced for every family-scoped table.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists users_email_unique on users (lower(email)) where deleted_at is null;

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  ip text
);
create index if not exists sessions_user_idx on sessions (user_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

create table if not exists email_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('verify', 'reset')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_tokens_user_idx on email_tokens (user_id, kind);

create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  avatar_url text,
  locale text not null default 'en' check (locale in ('en', 'fr', 'es', 'ar')),
  timezone text not null default 'UTC',
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  date_format text not null default 'DD/MM/YYYY',
  time_format text not null default '24h' check (time_format in ('12h', '24h')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  quiet_start time,
  quiet_end time,
  push_enabled boolean not null default true,
  email_reminders boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Families
-- ---------------------------------------------------------------------------
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  owner_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists families_owner_idx on families (owner_id);

create table if not exists family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'parent', 'caregiver', 'viewer')),
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);
create index if not exists family_members_user_idx on family_members (user_id, status);
create index if not exists family_members_family_idx on family_members (family_id, status);

create table if not exists family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  email text not null,
  role text not null default 'parent' check (role in ('parent', 'caregiver', 'viewer')),
  token_hash text not null unique,
  code text not null unique,
  invited_by uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invitations_family_idx on family_invitations (family_id, created_at desc);
create index if not exists invitations_email_idx on family_invitations (lower(email));

create table if not exists babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 60),
  last_name text,
  photo_url text,
  date_of_birth date not null,
  birth_time time,
  sex text not null check (sex in ('female', 'male', 'unspecified')),
  birth_weight_g integer check (birth_weight_g is null or birth_weight_g between 200 and 9000),
  birth_height_cm numeric(5,2) check (birth_height_cm is null or birth_height_cm between 20 and 120),
  head_circumference_cm numeric(5,2) check (head_circumference_cm is null or head_circumference_cm between 15 and 80),
  blood_type text check (blood_type is null or blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  pediatrician_name text,
  pediatrician_phone text,
  allergies text,
  notes text,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists babies_family_idx on babies (family_id, archived_at);

-- ---------------------------------------------------------------------------
-- Trackers
-- ---------------------------------------------------------------------------
create table if not exists feeding_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  type text not null check (type in ('breast', 'formula', 'expressed', 'solid')),
  started_at timestamptz not null,
  ended_at timestamptz,
  left_seconds integer not null default 0 check (left_seconds >= 0),
  right_seconds integer not null default 0 check (right_seconds >= 0),
  last_side text check (last_side in ('left', 'right', 'both')),
  active_side text check (active_side in ('left', 'right')),
  segments jsonb not null default '[]'::jsonb,
  formula_brand text,
  amount_ml integer check (amount_ml is null or amount_ml between 0 and 3000),
  water_ml integer check (water_ml is null or water_ml between 0 and 3000),
  powder_g numeric(6,1) check (powder_g is null or powder_g between 0 and 1000),
  bottle_type text,
  storage_location text,
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index if not exists feeding_baby_time_idx on feeding_sessions (baby_id, started_at desc) where deleted_at is null;
create index if not exists feeding_family_time_idx on feeding_sessions (family_id, started_at desc) where deleted_at is null;

create table if not exists diaper_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  occurred_at timestamptz not null,
  kind text not null check (kind in ('wet', 'dirty', 'mixed', 'dry')),
  urine_amount text check (urine_amount in ('small', 'medium', 'large')),
  urine_color text,
  stool_consistency text check (stool_consistency in ('watery', 'soft', 'normal', 'hard', 'mucus')),
  stool_color text check (stool_color in ('yellow', 'mustard', 'brown', 'green', 'other')),
  stool_amount text check (stool_amount in ('small', 'medium', 'large')),
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index if not exists diaper_baby_time_idx on diaper_entries (baby_id, occurred_at desc) where deleted_at is null;
create index if not exists diaper_family_time_idx on diaper_entries (family_id, occurred_at desc) where deleted_at is null;

create table if not exists sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  kind text not null default 'nap' check (kind in ('nap', 'night')),
  quality integer check (quality is null or quality between 1 and 5),
  interruptions jsonb not null default '[]'::jsonb,
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index if not exists sleep_baby_time_idx on sleep_sessions (baby_id, started_at desc) where deleted_at is null;
create index if not exists sleep_family_time_idx on sleep_sessions (family_id, started_at desc) where deleted_at is null;

create table if not exists growth_measurements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  measured_at timestamptz not null,
  weight_g integer check (weight_g is null or weight_g between 200 and 60000),
  height_cm numeric(5,2) check (height_cm is null or height_cm between 20 and 200),
  head_circumference_cm numeric(5,2) check (head_circumference_cm is null or head_circumference_cm between 15 and 80),
  source text not null default 'measured' check (source in ('measured', 'estimated')),
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index if not exists growth_baby_time_idx on growth_measurements (baby_id, measured_at desc) where deleted_at is null;

create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  name text not null,
  dosage text,
  frequency text,
  start_date date,
  end_date date,
  active boolean not null default true,
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists medication_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  medication_id uuid references medications(id) on delete set null,
  name text not null,
  dose text,
  given_at timestamptz not null,
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists temperature_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  measured_at timestamptz not null,
  celsius numeric(4,1) not null check (celsius between 30 and 45),
  method text check (method in ('axillary', 'oral', 'rectal', 'ear', 'forehead')),
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists vaccinations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  name text not null,
  scheduled_date date,
  administered_date date,
  dose text,
  provider text,
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  title text not null,
  doctor text,
  location text,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists symptoms (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  occurred_at timestamptz not null,
  description text not null,
  severity text not null default 'mild' check (severity in ('mild', 'moderate', 'severe')),
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  type text not null check (type in ('bath', 'tummy', 'play', 'walk', 'vitamin', 'pumping', 'solid', 'custom')),
  label text,
  started_at timestamptz not null,
  ended_at timestamptz,
  amount_ml integer check (amount_ml is null or amount_ml between 0 and 3000),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);
create index if not exists activities_baby_time_idx on activities (baby_id, started_at desc) where deleted_at is null;

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  title text not null,
  achieved_at timestamptz not null,
  photo_url text,
  notes text,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);

create table if not exists baby_notes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid not null references babies(id) on delete cascade,
  body text not null,
  recorded_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1
);

-- ---------------------------------------------------------------------------
-- Reminders, notifications, uploads, audit
-- ---------------------------------------------------------------------------
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid references babies(id) on delete cascade,
  type text not null check (type in ('feeding', 'diaper', 'medication', 'sleep', 'pumping', 'appointment', 'custom')),
  label text not null,
  enabled boolean not null default true,
  schedule_kind text not null default 'interval' check (schedule_kind in ('interval', 'daily')),
  interval_minutes integer check (interval_minutes is null or interval_minutes between 5 and 10080),
  times text[],
  days smallint[],
  next_due_at timestamptz,
  last_fired_at timestamptz,
  created_by uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists reminders_due_idx on reminders (next_due_at) where enabled and deleted_at is null;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  family_id uuid references families(id) on delete cascade,
  reminder_id uuid references reminders(id) on delete set null,
  title text not null,
  body text not null,
  url text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists notifications_dedupe_idx on notifications (dedupe_key) where dedupe_key is not null;
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  baby_id uuid references babies(id) on delete cascade,
  uploaded_by uuid not null references users(id) on delete cascade,
  storage_key text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 15728640),
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  actor_id uuid not null references users(id) on delete cascade,
  entity text not null,
  entity_id uuid,
  action text not null check (action in ('create', 'update', 'delete', 'invite', 'accept', 'remove', 'restore')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_family_idx on audit_logs (family_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function app_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create or replace function user_family_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select family_id from family_members
  where user_id = app_user_id() and status = 'active'
$$;

create or replace function user_family_role(f uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from family_members
  where family_id = f and user_id = app_user_id() and status = 'active'
  limit 1
$$;

create or replace function owns_family(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from families where id = f and owner_id = app_user_id())
$$;

create or replace function can_write_family(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(user_family_role(f) in ('owner', 'parent', 'caregiver'), false)
$$;

create or replace function can_manage_family(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(user_family_role(f) in ('owner', 'parent'), false)
$$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function notify_family_event() returns trigger
language plpgsql as $$
declare
  payload jsonb;
  fid uuid;
begin
  if tg_op = 'DELETE' then
    fid := old.family_id;
    payload := jsonb_build_object('familyId', fid, 'table', tg_table_name, 'id', old.id, 'op', 'delete');
  else
    fid := new.family_id;
    payload := jsonb_build_object('familyId', fid, 'table', tg_table_name, 'id', new.id, 'op', lower(tg_op));
  end if;
  perform pg_notify('bloom_events', payload::text);
  return coalesce(new, old);
end;
$$;

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array[
    'users','profiles','families','babies','feeding_sessions','diaper_entries',
    'sleep_sessions','growth_measurements','medications','medication_logs',
    'temperature_records','vaccinations','appointments','symptoms','activities',
    'milestones','baby_notes','reminders'
  ] loop
    execute format('drop trigger if exists touch_%I on %I', t, t);
    execute format('create trigger touch_%I before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- realtime triggers
do $$
declare t text;
begin
  foreach t in array array[
    'babies','feeding_sessions','diaper_entries','sleep_sessions','growth_measurements',
    'medications','medication_logs','temperature_records','vaccinations','appointments',
    'symptoms','activities','milestones','baby_notes','reminders'
  ] loop
    execute format('drop trigger if exists realtime_%I on %I', t, t);
    execute format('create trigger realtime_%I after insert or update or delete on %I for each row execute function notify_family_event()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Invitations: token-holder acceptance runs with definer rights, validates email.
-- ---------------------------------------------------------------------------
create or replace function accept_family_invitation(p_token_hash text, p_email text, p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare inv family_invitations;
begin
  select * into inv from family_invitations
   where token_hash = p_token_hash
     and accepted_at is null
     and revoked_at is null
     and expires_at > now()
   for update;
  if inv.id is null then
    raise exception 'invalid_invitation';
  end if;
  if lower(inv.email) <> lower(p_email) then
    raise exception 'email_mismatch';
  end if;
  insert into family_members (family_id, user_id, role, status)
  values (inv.family_id, p_user_id, inv.role, 'active')
  on conflict (family_id, user_id) do update set status = 'active', role = excluded.role;
  update family_invitations set accepted_at = now() where id = inv.id;
  return inv.family_id;
end;
$$;
revoke all on function accept_family_invitation(text, text, uuid) from public;
grant execute on function accept_family_invitation(text, text, uuid) to bloom_app;

create or replace function preview_family_invitation(p_token_hash text)
returns table (family_name text, invited_email text, invited_role text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.name, i.email, i.role, i.expires_at
  from family_invitations i
  join families f on f.id = i.family_id
  where i.token_hash = p_token_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
$$;
revoke all on function preview_family_invitation(text) from public;
grant execute on function preview_family_invitation(text) to bloom_app;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table families enable row level security;
alter table family_members enable row level security;
alter table family_invitations enable row level security;
alter table babies enable row level security;
alter table feeding_sessions enable row level security;
alter table diaper_entries enable row level security;
alter table sleep_sessions enable row level security;
alter table growth_measurements enable row level security;
alter table medications enable row level security;
alter table medication_logs enable row level security;
alter table temperature_records enable row level security;
alter table vaccinations enable row level security;
alter table appointments enable row level security;
alter table symptoms enable row level security;
alter table activities enable row level security;
alter table milestones enable row level security;
alter table baby_notes enable row level security;
alter table reminders enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table attachments enable row level security;
alter table audit_logs enable row level security;

-- profiles
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for all
  using (user_id = app_user_id()) with check (user_id = app_user_id());

-- families
drop policy if exists families_read on families;
create policy families_read on families for select using (id in (select user_family_ids()) or owner_id = app_user_id());
drop policy if exists families_insert on families;
create policy families_insert on families for insert with check (owner_id = app_user_id());
drop policy if exists families_update on families;
create policy families_update on families for update
  using (owner_id = app_user_id()) with check (owner_id = app_user_id());
drop policy if exists families_delete on families;
create policy families_delete on families for delete using (owner_id = app_user_id());

-- family members
drop policy if exists members_read on family_members;
create policy members_read on family_members for select
  using (family_id in (select user_family_ids()));
drop policy if exists members_insert on family_members;
create policy members_insert on family_members for insert
  with check ((user_id = app_user_id() and owns_family(family_id)) or user_family_role(family_id) = 'owner');
drop policy if exists members_update on family_members;
create policy members_update on family_members for update
  using (user_family_role(family_id) = 'owner') with check (user_family_role(family_id) = 'owner');
drop policy if exists members_delete on family_members;
create policy members_delete on family_members for delete using (user_family_role(family_id) = 'owner');

-- invitations
drop policy if exists invitations_read on family_invitations;
create policy invitations_read on family_invitations for select using (family_id in (select user_family_ids()));
drop policy if exists invitations_insert on family_invitations;
create policy invitations_insert on family_invitations for insert with check (can_manage_family(family_id) and invited_by = app_user_id());
drop policy if exists invitations_update on family_invitations;
create policy invitations_update on family_invitations for update using (can_manage_family(family_id)) with check (can_manage_family(family_id));
drop policy if exists invitations_delete on family_invitations;
create policy invitations_delete on family_invitations for delete using (can_manage_family(family_id));

-- babies
drop policy if exists babies_read on babies;
create policy babies_read on babies for select using (family_id in (select user_family_ids()));
drop policy if exists babies_insert on babies;
create policy babies_insert on babies for insert with check (can_manage_family(family_id) and created_by = app_user_id());
drop policy if exists babies_update on babies;
create policy babies_update on babies for update using (can_manage_family(family_id)) with check (can_manage_family(family_id));
drop policy if exists babies_delete on babies;
create policy babies_delete on babies for delete using (can_manage_family(family_id));

-- generic activity policies (recorded_by ownership for caregivers)
do $$
declare t text;
begin
  foreach t in array array[
    'feeding_sessions','diaper_entries','sleep_sessions','growth_measurements','medications',
    'medication_logs','temperature_records','vaccinations','appointments','symptoms',
    'activities','milestones','baby_notes'
  ] loop
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format('create policy %I_read on %I for select using (family_id in (select user_family_ids()))', t, t);
    execute format('drop policy if exists %I_insert on %I', t, t);
    execute format('create policy %I_insert on %I for insert with check (can_write_family(family_id) and recorded_by = app_user_id())', t, t);
    execute format('drop policy if exists %I_update on %I', t, t);
    execute format('create policy %I_update on %I for update using (family_id in (select user_family_ids()) and (user_family_role(family_id) in (''owner'',''parent'') or (user_family_role(family_id) = ''caregiver'' and recorded_by = app_user_id()))) with check (family_id in (select user_family_ids()) and (user_family_role(family_id) in (''owner'',''parent'') or (user_family_role(family_id) = ''caregiver'' and recorded_by = app_user_id())))', t, t);
    execute format('drop policy if exists %I_delete on %I', t, t);
    execute format('create policy %I_delete on %I for delete using (family_id in (select user_family_ids()) and (user_family_role(family_id) in (''owner'',''parent'') or (user_family_role(family_id) = ''caregiver'' and recorded_by = app_user_id())))', t, t);
  end loop;
end $$;

-- reminders: family-level, managed by parents/owner
drop policy if exists reminders_read on reminders;
create policy reminders_read on reminders for select using (family_id in (select user_family_ids()));
drop policy if exists reminders_insert on reminders;
create policy reminders_insert on reminders for insert with check (can_write_family(family_id) and created_by = app_user_id());
drop policy if exists reminders_update on reminders;
create policy reminders_update on reminders for update using (can_manage_family(family_id)) with check (can_manage_family(family_id));
drop policy if exists reminders_delete on reminders;
create policy reminders_delete on reminders for delete using (can_manage_family(family_id));

-- notifications: strictly personal
drop policy if exists notifications_self on notifications;
create policy notifications_self on notifications for all
  using (user_id = app_user_id()) with check (user_id = app_user_id());

-- push subscriptions: strictly personal
drop policy if exists push_self on push_subscriptions;
create policy push_self on push_subscriptions for all
  using (user_id = app_user_id()) with check (user_id = app_user_id());

-- attachments: read for family, delete uploader or managers
drop policy if exists attachments_read on attachments;
create policy attachments_read on attachments for select using (family_id in (select user_family_ids()));
drop policy if exists attachments_insert on attachments;
create policy attachments_insert on attachments for insert with check (can_write_family(family_id) and uploaded_by = app_user_id());
drop policy if exists attachments_delete on attachments;
create policy attachments_delete on attachments for delete using (family_id in (select user_family_ids()) and (user_family_role(family_id) in ('owner','parent') or uploaded_by = app_user_id()));

-- audit: readable to managers, append-only
drop policy if exists audit_read on audit_logs;
create policy audit_read on audit_logs for select using (can_manage_family(family_id));
drop policy if exists audit_insert on audit_logs;
create policy audit_insert on audit_logs for insert with check (family_id in (select user_family_ids()) and actor_id = app_user_id());

-- ---------------------------------------------------------------------------
-- Grants for the restricted application role
-- ---------------------------------------------------------------------------
grant usage on schema public to bloom_app;
grant select, insert, update, delete on all tables in schema public to bloom_app;
grant usage, select on all sequences in schema public to bloom_app;
alter default privileges in schema public grant select, insert, update, delete on tables to bloom_app;
alter default privileges in schema public grant usage, select on sequences to bloom_app;

-- Invitation codes (short, human-shareable) --------------------------------
create or replace function preview_family_invitation_by_code(p_code text)
returns table (family_name text, invited_email text, invited_role text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.name, i.email, i.role, i.expires_at
  from family_invitations i
  join families f on f.id = i.family_id
  where upper(i.code) = upper(p_code)
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
$$;
revoke all on function preview_family_invitation_by_code(text) from public;
grant execute on function preview_family_invitation_by_code(text) to bloom_app;

create or replace function accept_family_invitation_by_code(p_code text, p_email text, p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare inv family_invitations;
begin
  select * into inv from family_invitations
   where upper(code) = upper(p_code)
     and accepted_at is null and revoked_at is null and expires_at > now()
   for update;
  if inv.id is null then raise exception 'invalid_invitation'; end if;
  if lower(inv.email) <> lower(p_email) then raise exception 'email_mismatch'; end if;
  insert into family_members (family_id, user_id, role, status)
  values (inv.family_id, p_user_id, inv.role, 'active')
  on conflict (family_id, user_id) do update set status = 'active', role = excluded.role;
  update family_invitations set accepted_at = now() where id = inv.id;
  return inv.family_id;
end;
$$;
revoke all on function accept_family_invitation_by_code(text, text, uuid) from public;
grant execute on function accept_family_invitation_by_code(text, text, uuid) to bloom_app;

-- Keep feeding reminders aligned with the last feed, including feeds logged by
-- caregivers (who cannot update family reminders directly under RLS).
create or replace function bump_feeding_reminders(p_family uuid, p_baby uuid, p_started timestamptz)
returns void
language sql security definer set search_path = public as $$
  update reminders
     set next_due_at = p_started + (coalesce(interval_minutes, 180) || ' minutes')::interval,
         last_fired_at = null
   where family_id = p_family
     and type = 'feeding'
     and enabled
     and deleted_at is null
     and (baby_id is null or baby_id = p_baby);
$$;
revoke all on function bump_feeding_reminders(uuid, uuid, timestamptz) from public;
grant execute on function bump_feeding_reminders(uuid, uuid, timestamptz) to bloom_app;
