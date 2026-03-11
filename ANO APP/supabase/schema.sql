create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('farmer', 'board');
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.app_role'::regtype
      and enumlabel = 'agronomist'
  ) then
    alter type public.app_role add value 'agronomist';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.app_role'::regtype
      and enumlabel = 'staff'
  ) then
    alter type public.app_role add value 'staff';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.app_role'::regtype
      and enumlabel = 'admin'
  ) then
    alter type public.app_role add value 'admin';
  end if;

  if not exists (select 1 from pg_type where typname = 'board_status') then
    create type public.board_status as enum ('not-linked', 'linked', 'verified');
  end if;

  if not exists (select 1 from pg_type where typname = 'country_name') then
    create type public.country_name as enum ('Zimbabwe', 'Eswatini');
  end if;
end $$;

create table if not exists public.marketing_boards (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.regions (
  id text primary key,
  country public.country_name not null,
  name text not null,
  rainfall_pattern text not null,
  latitude numeric(8, 4) not null,
  longitude numeric(8, 4) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.crops (
  id text primary key,
  name text not null,
  board_id text not null references public.marketing_boards(id) on delete restrict,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  role public.app_role not null default 'farmer',
  full_name text not null default '',
  country public.country_name not null default 'Zimbabwe',
  region_id text not null references public.regions(id) on delete restrict,
  board_id text references public.marketing_boards(id) on delete set null,
  location_detail text not null default '',
  whatsapp_number text not null default '',
  specialization_ids text[] not null default '{}',
  availability_status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farm_team_invites (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.user_profiles(id) on delete cascade,
  invite_code text not null unique,
  label text not null,
  team_role text not null check (team_role in ('manager', 'scout', 'worker')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  is_active boolean not null default true
);

create table if not exists public.farm_team_members (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.user_profiles(id) on delete cascade,
  staff_id uuid not null references public.user_profiles(id) on delete cascade,
  team_role text not null check (team_role in ('manager', 'scout', 'worker')),
  status text not null default 'active' check (status in ('active')),
  created_at timestamptz not null default now(),
  unique (farmer_id, staff_id)
);

create table if not exists public.board_registry_records (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.marketing_boards(id) on delete cascade,
  crop_id text not null references public.crops(id) on delete cascade,
  grower_name text not null,
  region_id text not null references public.regions(id) on delete restrict,
  grower_id text not null,
  pin text not null,
  status public.board_status not null default 'verified',
  created_at timestamptz not null default now(),
  unique (board_id, crop_id, grower_id)
);

create table if not exists public.farmer_crop_plans (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.user_profiles(id) on delete cascade,
  crop_id text not null references public.crops(id) on delete cascade,
  board_id text not null references public.marketing_boards(id) on delete restrict,
  planting_date date not null,
  total_area_ha numeric(12, 2) not null default 0,
  grower_id text,
  board_status public.board_status not null default 'not-linked',
  verification_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farmer_id, crop_id)
);

create table if not exists public.planting_progress_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.farmer_crop_plans(id) on delete cascade,
  farmer_id uuid not null references public.user_profiles(id) on delete cascade,
  crop_id text not null references public.crops(id) on delete cascade,
  entry_date date not null,
  area_ha numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.board_transactions (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.user_profiles(id) on delete cascade,
  crop_id text not null references public.crops(id) on delete cascade,
  board_id text not null references public.marketing_boards(id) on delete restrict,
  delivery_point text not null,
  target_delivery_date date not null,
  estimated_volume numeric(14, 2) not null,
  actual_delivered_volume numeric(14, 2),
  estimated_gross_usd numeric(14, 2),
  estimated_net_usd numeric(14, 2),
  delivery_status text not null default 'not-booked',
  payment_status text not null default 'not-raised',
  payment_due_date date,
  payment_reference text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farmer_id, crop_id)
);

create table if not exists public.crop_enquiries (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.user_profiles(id) on delete cascade,
  crop_id text not null references public.crops(id) on delete cascade,
  board_id text not null references public.marketing_boards(id) on delete restrict,
  issue_id text not null,
  note text not null default '',
  image_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  region_id text not null references public.regions(id) on delete cascade,
  forecast_date date not null,
  max_temp integer not null,
  rain_chance integer not null,
  rain_mm numeric(8, 2) not null,
  source text not null default 'open-meteo',
  created_at timestamptz not null default now(),
  unique (region_id, forecast_date, source)
);

alter table public.farmer_crop_plans
add column if not exists total_area_ha numeric(12, 2) not null default 0;

alter table public.user_profiles
add column if not exists location_detail text not null default '';

alter table public.user_profiles
add column if not exists whatsapp_number text not null default '';

alter table public.user_profiles
add column if not exists specialization_ids text[] not null default '{}';

alter table public.user_profiles
add column if not exists availability_status text not null default 'available';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_user_profiles on public.user_profiles;
create trigger touch_user_profiles
before update on public.user_profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists touch_farmer_crop_plans on public.farmer_crop_plans;
create trigger touch_farmer_crop_plans
before update on public.farmer_crop_plans
for each row
execute function public.touch_updated_at();

drop trigger if exists touch_board_transactions on public.board_transactions;
create trigger touch_board_transactions
before update on public.board_transactions
for each row
execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.app_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'farmer');
  invite_code_input text := upper(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  linked_invite public.farm_team_invites;
  linked_farmer public.user_profiles;
  resolved_country public.country_name := coalesce((new.raw_user_meta_data ->> 'country')::public.country_name, 'Zimbabwe');
  resolved_region text := coalesce(new.raw_user_meta_data ->> 'region_id', 'mash-west');
begin
  if requested_role = 'staff' then
    select *
    into linked_invite
    from public.farm_team_invites
    where upper(invite_code) = invite_code_input
      and is_active = true
    limit 1;

    if linked_invite.id is null then
      raise exception 'Farm team invite not found or inactive';
    end if;

    select *
    into linked_farmer
    from public.user_profiles
    where id = linked_invite.farmer_id;

    if linked_farmer.id is null then
      raise exception 'Linked farmer profile not found for invite';
    end if;

    resolved_country := linked_farmer.country;
    resolved_region := linked_farmer.region_id;
  end if;

  insert into public.user_profiles (
    id,
    email,
    role,
    full_name,
    country,
    region_id,
    board_id,
    location_detail,
    whatsapp_number,
    specialization_ids,
    availability_status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    requested_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    resolved_country,
    resolved_region,
    nullif(new.raw_user_meta_data ->> 'board_id', ''),
    coalesce(new.raw_user_meta_data ->> 'location_detail', ''),
    coalesce(new.raw_user_meta_data ->> 'whatsapp_number', ''),
    coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(new.raw_user_meta_data -> 'specialization_ids', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    ),
    coalesce(new.raw_user_meta_data ->> 'availability_status', 'available')
  )
  on conflict (id) do nothing;

  if requested_role = 'staff' then
    insert into public.farm_team_members (
      farmer_id,
      staff_id,
      team_role,
      status
    )
    values (
      linked_invite.farmer_id,
      new.id,
      linked_invite.team_role,
      'active'
    )
    on conflict (farmer_id, staff_id)
    do update set
      team_role = excluded.team_role,
      status = excluded.status;

    update public.farm_team_invites
    set
      claimed_at = now(),
      is_active = false
    where id = linked_invite.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.user_profiles where id = auth.uid()
$$;

create or replace function public.current_board_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select board_id from public.user_profiles where id = auth.uid()
$$;

create or replace function public.current_region_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select region_id from public.user_profiles where id = auth.uid()
$$;

create or replace function public.current_country()
returns public.country_name
language sql
stable
security definer
set search_path = public
as $$
  select country from public.user_profiles where id = auth.uid()
$$;

drop function if exists public.save_farmer_crop_plan(text, date);

create or replace function public.save_farmer_crop_plan(
  crop_key text,
  planting_on date,
  total_area_ha_input numeric
)
returns setof public.farmer_crop_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  matching_registry public.board_registry_records;
  crop_record public.crops;
  saved_plan public.farmer_crop_plans;
begin
  select * into current_profile from public.user_profiles where id = auth.uid();
  if current_profile.id is null then
    raise exception 'Authenticated farmer profile not found';
  end if;

  select * into crop_record from public.crops where id = crop_key;
  if crop_record.id is null then
    raise exception 'Crop not found';
  end if;

  select *
  into matching_registry
  from public.board_registry_records
  where crop_id = crop_key
    and region_id = current_profile.region_id
    and lower(grower_name) = lower(current_profile.full_name)
  limit 1;

  insert into public.farmer_crop_plans (
    farmer_id,
    crop_id,
    board_id,
    planting_date,
    total_area_ha,
    grower_id,
    board_status,
    verification_source
  )
  values (
    current_profile.id,
    crop_record.id,
    crop_record.board_id,
    planting_on,
    coalesce(total_area_ha_input, 0),
    matching_registry.grower_id,
    case when matching_registry.id is not null then 'verified' else 'not-linked' end,
    case when matching_registry.id is not null then 'registry-auto' else 'manual' end
  )
  on conflict (farmer_id, crop_id)
  do update set
    planting_date = excluded.planting_date,
    total_area_ha = excluded.total_area_ha,
    board_id = excluded.board_id,
    grower_id = excluded.grower_id,
    board_status = excluded.board_status,
    verification_source = excluded.verification_source,
    updated_at = now()
  returning * into saved_plan;

  return query select * from public.farmer_crop_plans where id = saved_plan.id;
end;
$$;

create or replace function public.link_board_identity(
  crop_key text,
  grower_id_input text,
  pin_input text
)
returns setof public.farmer_crop_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  crop_record public.crops;
  matching_registry public.board_registry_records;
  saved_plan public.farmer_crop_plans;
begin
  select * into current_profile from public.user_profiles where id = auth.uid();
  if current_profile.id is null then
    raise exception 'Authenticated farmer profile not found';
  end if;

  select * into crop_record from public.crops where id = crop_key;
  if crop_record.id is null then
    raise exception 'Crop not found';
  end if;

  select *
  into matching_registry
  from public.board_registry_records
  where crop_id = crop_key
    and board_id = crop_record.board_id
    and lower(grower_id) = lower(grower_id_input)
    and pin = pin_input
  limit 1;

  insert into public.farmer_crop_plans (
    farmer_id,
    crop_id,
    board_id,
    planting_date,
    total_area_ha,
    grower_id,
    board_status,
    verification_source
  )
  values (
    current_profile.id,
    crop_record.id,
    crop_record.board_id,
    current_date,
    0,
    grower_id_input,
    case when matching_registry.id is not null then 'verified' else 'linked' end,
    case when matching_registry.id is not null then 'registry-pin' else 'manual-link' end
  )
  on conflict (farmer_id, crop_id)
  do update set
    grower_id = excluded.grower_id,
    board_status = excluded.board_status,
    verification_source = excluded.verification_source,
    updated_at = now()
  returning * into saved_plan;

  return query select * from public.farmer_crop_plans where id = saved_plan.id;
end;
$$;

alter table public.user_profiles enable row level security;
alter table public.board_registry_records enable row level security;
alter table public.farmer_crop_plans enable row level security;
alter table public.planting_progress_entries enable row level security;
alter table public.board_transactions enable row level security;
alter table public.crop_enquiries enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.farm_team_invites enable row level security;
alter table public.farm_team_members enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
on public.user_profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_role() = 'admin'
  or (
    public.current_role() = 'board'
    and role = 'farmer'
    and exists (
      select 1 from public.farmer_crop_plans plans
      where plans.farmer_id = user_profiles.id
        and plans.board_id = public.current_board_id()
    )
  )
  or (
    public.current_role() = 'farmer'
    and role = 'agronomist'
    and country = public.current_country()
  )
  or (
    public.current_role() = 'farmer'
    and role = 'staff'
    and exists (
      select 1 from public.farm_team_members team
      where team.farmer_id = auth.uid()
        and team.staff_id = user_profiles.id
        and team.status = 'active'
    )
  )
  or (
    public.current_role() = 'agronomist'
    and role = 'farmer'
    and region_id = public.current_region_id()
  )
  or (
    public.current_role() = 'staff'
    and role = 'farmer'
    and exists (
      select 1 from public.farm_team_members team
      where team.farmer_id = user_profiles.id
        and team.staff_id = auth.uid()
        and team.status = 'active'
    )
  )
);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
on public.user_profiles
for update
to authenticated
using (id = auth.uid() or public.current_role() = 'admin')
with check (id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "Farmers can view own plans and boards can view matching plans" on public.farmer_crop_plans;
create policy "Farmers can view own plans and boards can view matching plans"
on public.farmer_crop_plans
for select
to authenticated
using (
  farmer_id = auth.uid()
  or public.current_role() = 'admin'
  or (public.current_role() = 'board' and board_id = public.current_board_id())
  or (
    public.current_role() = 'agronomist'
    and exists (
      select 1 from public.user_profiles farmer_profile
      where farmer_profile.id = farmer_crop_plans.farmer_id
        and farmer_profile.region_id = public.current_region_id()
    )
  )
  or (
    public.current_role() = 'staff'
    and exists (
      select 1 from public.farm_team_members team
      where team.farmer_id = farmer_crop_plans.farmer_id
        and team.staff_id = auth.uid()
        and team.status = 'active'
    )
  )
);

drop policy if exists "Farmers manage own plans" on public.farmer_crop_plans;
create policy "Farmers manage own plans"
on public.farmer_crop_plans
for all
to authenticated
using (farmer_id = auth.uid())
with check (farmer_id = auth.uid());

drop policy if exists "Farmers view own planting progress" on public.planting_progress_entries;
create policy "Farmers view own planting progress"
on public.planting_progress_entries
for select
to authenticated
using (
  farmer_id = auth.uid()
  or public.current_role() = 'admin'
  or (
    public.current_role() = 'staff'
    and exists (
      select 1 from public.farm_team_members team
      where team.farmer_id = planting_progress_entries.farmer_id
        and team.staff_id = auth.uid()
        and team.status = 'active'
    )
  )
);

drop policy if exists "Farmers insert own planting progress" on public.planting_progress_entries;
create policy "Farmers insert own planting progress"
on public.planting_progress_entries
for insert
to authenticated
with check (
  farmer_id = auth.uid()
  or (
    public.current_role() = 'staff'
    and exists (
      select 1 from public.farm_team_members team
      where team.farmer_id = planting_progress_entries.farmer_id
        and team.staff_id = auth.uid()
        and team.status = 'active'
    )
  )
);

drop policy if exists "Farmers and boards view board transactions" on public.board_transactions;
create policy "Farmers and boards view board transactions"
on public.board_transactions
for select
to authenticated
using (
  farmer_id = auth.uid()
  or public.current_role() = 'admin'
  or (public.current_role() = 'board' and board_id = public.current_board_id())
  or (
    public.current_role() = 'staff'
    and exists (
      select 1 from public.farm_team_members team
      where team.farmer_id = board_transactions.farmer_id
        and team.staff_id = auth.uid()
        and team.status = 'active'
    )
  )
);

drop policy if exists "Farmers manage own board transactions" on public.board_transactions;
create policy "Farmers manage own board transactions"
on public.board_transactions
for all
to authenticated
using (farmer_id = auth.uid())
with check (farmer_id = auth.uid());

drop policy if exists "Boards update own board transactions" on public.board_transactions;
create policy "Boards update own board transactions"
on public.board_transactions
for update
to authenticated
using (
  (public.current_role() = 'board' and board_id = public.current_board_id())
  or public.current_role() = 'admin'
)
with check (
  (public.current_role() = 'board' and board_id = public.current_board_id())
  or public.current_role() = 'admin'
);

drop policy if exists "Boards view own registry" on public.board_registry_records;
create policy "Boards view own registry"
on public.board_registry_records
for select
to authenticated
using (
  (public.current_role() = 'board' and board_id = public.current_board_id())
  or public.current_role() = 'admin'
);

drop policy if exists "Farmers view own enquiries and boards view matching enquiries" on public.crop_enquiries;
create policy "Farmers view own enquiries and boards view matching enquiries"
on public.crop_enquiries
for select
to authenticated
using (
  farmer_id = auth.uid()
  or public.current_role() = 'admin'
  or (public.current_role() = 'board' and board_id = public.current_board_id())
  or (
    public.current_role() = 'agronomist'
    and exists (
      select 1 from public.user_profiles farmer_profile
      where farmer_profile.id = crop_enquiries.farmer_id
        and farmer_profile.region_id = public.current_region_id()
    )
  )
  or (
    public.current_role() = 'staff'
    and exists (
      select 1 from public.farm_team_members team
      where team.farmer_id = crop_enquiries.farmer_id
        and team.staff_id = auth.uid()
        and team.status = 'active'
    )
  )
);

drop policy if exists "Farmers insert own enquiries" on public.crop_enquiries;
create policy "Farmers insert own enquiries"
on public.crop_enquiries
for insert
to authenticated
with check (farmer_id = auth.uid());

drop policy if exists "Farmers view weather snapshots" on public.weather_snapshots;
create policy "Farmers view weather snapshots"
on public.weather_snapshots
for select
to authenticated
using (true);

drop policy if exists "Farmers manage own team invites" on public.farm_team_invites;
create policy "Farmers manage own team invites"
on public.farm_team_invites
for all
to authenticated
using (farmer_id = auth.uid() or public.current_role() = 'admin')
with check (farmer_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "Farmers and staff view team memberships" on public.farm_team_members;
create policy "Farmers and staff view team memberships"
on public.farm_team_members
for select
to authenticated
using (
  farmer_id = auth.uid()
  or staff_id = auth.uid()
  or public.current_role() = 'admin'
);

grant execute on function public.save_farmer_crop_plan(text, date, numeric) to authenticated;
grant execute on function public.link_board_identity(text, text, text) to authenticated;

insert into public.marketing_boards (id, name)
values
  ('gmb', 'GMB Buyer Hub'),
  ('timb', 'TIMB Tobacco Portal'),
  ('sugar-hub', 'Sugar Buyer Contract Hub')
on conflict (id) do update set name = excluded.name;

insert into public.regions (id, country, name, rainfall_pattern, latitude, longitude)
values
  ('mash-west', 'Zimbabwe', 'Mashonaland West', 'High-potential summer rainfall with strong maize and tobacco windows.', -17.3700, 30.2000),
  ('mash-central', 'Zimbabwe', 'Mashonaland Central', 'Reliable rainfall for maize, tobacco and rotation crops.', -16.7600, 31.0100),
  ('mash-east', 'Zimbabwe', 'Mashonaland East', 'Mixed rainfall zones suited to maize, tobacco and irrigated wheat.', -18.1900, 31.5500),
  ('midlands', 'Zimbabwe', 'Midlands', 'Balanced rainfall where maize and wheat need tight irrigation planning.', -19.4500, 29.8200),
  ('manicaland', 'Zimbabwe', 'Manicaland', 'Humid eastern conditions support tobacco, maize and selected cane belts.', -18.9200, 32.1700),
  ('masvingo-lowveld', 'Zimbabwe', 'Masvingo Lowveld', 'Hot lowveld climate where irrigation discipline drives cane and wheat results.', -21.0400, 31.6700),
  ('mat-north', 'Zimbabwe', 'Matabeleland North', 'Drier conditions make moisture conservation and irrigation timing critical.', -18.5300, 27.2900),
  ('mat-south', 'Zimbabwe', 'Matabeleland South', 'Lower rainfall favors drought-aware maize and carefully planned winter wheat.', -21.0500, 29.3700),
  ('eswatini-lowveld', 'Eswatini', 'Eswatini Lowveld', 'Warm irrigated cane country with smaller maize and wheat windows.', -26.5400, 31.9800)
on conflict (id) do update set
  country = excluded.country,
  name = excluded.name,
  rainfall_pattern = excluded.rainfall_pattern,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

insert into public.crops (id, name, board_id, summary)
values
  ('maize', 'Maize', 'gmb', 'Region-aware variety selection, fertiliser timing, and weed control alerts.'),
  ('tobacco', 'Tobacco', 'timb', 'Variety fit, sucker management, disease scouting and staged feeding.'),
  ('wheat', 'Wheat', 'gmb', 'Winter wheat scheduling built around irrigation frequency and rust vigilance.'),
  ('sugarcane', 'Sugarcane', 'sugar-hub', 'Lowveld cane support with fertigation and ratoon timing guidance.'),
  ('soyabean', 'Soyabean', 'gmb', 'Rotation-friendly crop guidance with inoculation and rust-aware management.')
on conflict (id) do update set
  name = excluded.name,
  board_id = excluded.board_id,
  summary = excluded.summary;

insert into public.board_registry_records (board_id, crop_id, grower_name, region_id, grower_id, pin, status)
values
  ('gmb', 'maize', 'Tendai Moyo', 'mash-west', 'GMB-1048', '2468', 'verified'),
  ('gmb', 'wheat', 'Agness Ncube', 'midlands', 'GMB-2204', '7842', 'verified'),
  ('timb', 'tobacco', 'Blessing Dube', 'mash-central', 'TIMB-4431', '1188', 'verified'),
  ('sugar-hub', 'sugarcane', 'Sipho Dlamini', 'eswatini-lowveld', 'SUG-9012', '5521', 'verified'),
  ('sugar-hub', 'sugarcane', 'Farai Chikowore', 'masvingo-lowveld', 'SUG-7024', '3377', 'verified')
on conflict (board_id, crop_id, grower_id) do update set
  grower_name = excluded.grower_name,
  region_id = excluded.region_id,
  pin = excluded.pin,
  status = excluded.status;

insert into storage.buckets (id, name, public)
values ('crop-enquiries', 'crop-enquiries', false)
on conflict (id) do nothing;

drop policy if exists "Users manage own enquiry images" on storage.objects;
create policy "Users manage own enquiry images"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'crop-enquiries'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'crop-enquiries'
  and (storage.foldername(name))[1] = auth.uid()::text
);
