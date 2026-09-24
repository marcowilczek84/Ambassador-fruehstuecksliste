-- STAGING FIRST. Never run against the existing breakfast production project.
create schema if not exists guest_memory_private;
revoke all on schema guest_memory_private from public, anon, authenticated;

create table public.gm_hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);
create table public.gm_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  hotel_id uuid not null references public.gm_hotels(id) on delete cascade,
  work_role text not null check (work_role in ('SERVICE','RECEPTION')),
  active boolean not null default true,
  primary key (user_id, hotel_id)
);
create table public.gm_settings (
  hotel_id uuid primary key references public.gm_hotels(id) on delete cascade,
  stay_history_months integer not null default 24 check (stay_history_months between 1 and 120),
  deleted_note_days integer not null default 30 check (deleted_note_days between 1 and 365)
);

create table public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.gm_hotels(id),
  display_name text not null check (length(btrim(display_name)) > 0),
  normalized_name text not null check (length(btrim(normalized_name)) > 0),
  merged_into uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id,id),
  foreign key (hotel_id,merged_into) references public.guest_profiles(hotel_id,id),
  check (merged_into is null or merged_into <> id)
);
create index guest_profiles_candidate_idx on public.guest_profiles(hotel_id,normalized_name)
  where merged_into is null;

create table public.guest_stays (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.gm_hotels(id),
  guest_profile_id uuid null,
  original_name text not null check (length(btrim(original_name)) > 0),
  normalized_name text not null check (length(btrim(normalized_name)) > 0),
  arrival_date date not null,
  departure_date date not null,
  first_seen_on date not null default (now() at time zone 'Europe/Zurich')::date,
  last_seen_on date not null default (now() at time zone 'Europe/Zurich')::date,
  match_state text not null default 'UNLINKED'
    check (match_state in ('UNLINKED','CONFIRMED','REVIEW_REQUIRED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id,id),
  foreign key (hotel_id,guest_profile_id) references public.guest_profiles(hotel_id,id),
  check (departure_date >= arrival_date),
  check ((guest_profile_id is null) = (match_state <> 'CONFIRMED'))
);
create index guest_stays_match_idx on public.guest_stays
  (hotel_id,normalized_name,arrival_date,departure_date);
create index guest_stays_profile_idx on public.guest_stays(hotel_id,guest_profile_id,arrival_date desc)
  where guest_profile_id is not null;

create table public.guest_stay_rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null,
  stay_id uuid not null,
  room_number integer not null check (room_number between 1 and 9999),
  first_seen_on date not null,
  last_seen_on date not null,
  foreign key (hotel_id,stay_id) references public.guest_stays(hotel_id,id) on delete cascade,
  unique (hotel_id,stay_id,room_number,first_seen_on),
  check (last_seen_on >= first_seen_on)
);
create index guest_stay_rooms_room_idx on public.guest_stay_rooms(hotel_id,room_number,last_seen_on);

create table public.guest_notes (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.gm_hotels(id),
  note_type text not null check(note_type in ('STAY','PERSISTENT')),
  stay_id uuid null,
  guest_profile_id uuid null,
  body text not null check(length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  foreign key (hotel_id,stay_id) references public.guest_stays(hotel_id,id),
  foreign key (hotel_id,guest_profile_id) references public.guest_profiles(hotel_id,id),
  check ((note_type='STAY' and stay_id is not null and guest_profile_id is null)
     or (note_type='PERSISTENT' and stay_id is null and guest_profile_id is not null))
);
create index guest_notes_stay_idx on public.guest_notes(hotel_id,stay_id,created_at)
  where deleted_at is null and note_type='STAY';
create index guest_notes_profile_idx on public.guest_notes(hotel_id,guest_profile_id,created_at)
  where deleted_at is null and note_type='PERSISTENT';
create index guest_notes_expiry_idx on public.guest_notes(deleted_at) where deleted_at is not null;

create table public.guest_match_decisions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null,
  stay_id uuid not null,
  candidate_profile_id uuid not null,
  decision text not null check(decision in ('CONFIRMED','REJECTED')),
  decided_at timestamptz not null default now(),
  actor_role text not null default 'RECEPTION' check(actor_role='RECEPTION'),
  foreign key(hotel_id,stay_id) references public.guest_stays(hotel_id,id),
  foreign key(hotel_id,candidate_profile_id) references public.guest_profiles(hotel_id,id),
  unique(stay_id,candidate_profile_id)
);

create table public.guest_legacy_unresolved (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.gm_hotels(id),
  source_key text not null,
  original_body text not null check(length(btrim(original_body)) > 0),
  observed_on date null,
  room_number integer null,
  assignment_status text not null default 'UNRESOLVED'
    check(assignment_status in ('UNRESOLVED','ASSIGNED','DELETED')),
  resolved_stay_id uuid null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  foreign key(hotel_id,resolved_stay_id) references public.guest_stays(hotel_id,id),
  unique(hotel_id,source_key),
  check ((assignment_status='ASSIGNED')=(resolved_stay_id is not null))
);

create table public.guest_legacy_sources (
  hotel_id uuid not null references public.gm_hotels(id),
  source_key text not null,
  note_id uuid null references public.guest_notes(id),
  unresolved_id uuid null references public.guest_legacy_unresolved(id),
  primary key(hotel_id,source_key),
  check ((note_id is not null) <> (unresolved_id is not null))
);

create table public.guest_profile_merges (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.gm_hotels(id),
  source_profile_id uuid not null,
  target_profile_id uuid not null,
  merged_at timestamptz not null default now(),
  actor_role text not null default 'RECEPTION' check(actor_role='RECEPTION'),
  snapshot jsonb not null,
  restored_at timestamptz null,
  foreign key(hotel_id,source_profile_id) references public.guest_profiles(hotel_id,id),
  foreign key(hotel_id,target_profile_id) references public.guest_profiles(hotel_id,id),
  check(source_profile_id <> target_profile_id)
);

create function guest_memory_private.role_for(p_hotel uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.work_role from public.gm_memberships m
  where m.hotel_id=p_hotel and m.user_id=(select auth.uid()) and m.active
    and coalesce((select auth.jwt())->>'is_anonymous','true')='false'
  limit 1
$$;
revoke all on function guest_memory_private.role_for(uuid) from public,anon;
grant usage on schema guest_memory_private to authenticated;
grant execute on function guest_memory_private.role_for(uuid) to authenticated;

create function guest_memory_private.can_see_profile(p_hotel uuid,p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select guest_memory_private.role_for(p_hotel)='RECEPTION'
    or (guest_memory_private.role_for(p_hotel)='SERVICE' and exists(
      select 1 from public.guest_stays s
      where s.hotel_id=p_hotel and s.guest_profile_id=p_profile
        and s.match_state='CONFIRMED'
        and s.arrival_date <= (now() at time zone 'Europe/Zurich')::date
        and s.departure_date >= (now() at time zone 'Europe/Zurich')::date
    ))
$$;
revoke all on function guest_memory_private.can_see_profile(uuid,uuid) from public,anon;
grant execute on function guest_memory_private.can_see_profile(uuid,uuid) to authenticated;

create function guest_memory_private.note_timestamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' then
    if old.created_at is distinct from new.created_at
      or old.hotel_id is distinct from new.hotel_id
      or old.note_type is distinct from new.note_type
      or old.stay_id is distinct from new.stay_id
      or (old.guest_profile_id is distinct from new.guest_profile_id
          and current_setting('guest_memory.profile_merge',true) <> 'enabled') then
      raise exception 'note identity cannot be changed';
    end if;
    new.created_at := old.created_at;
    if old.body is distinct from new.body or old.deleted_at is distinct from new.deleted_at then
      new.updated_at := clock_timestamp();
    else
      new.updated_at := old.updated_at;
    end if;
  end if;
  return new;
end $$;
create trigger guest_notes_timestamp before update on public.guest_notes
  for each row execute function guest_memory_private.note_timestamp();

-- Never inherit broad privileges from the existing breakfast tables.
alter table public.gm_hotels enable row level security;
alter table public.gm_memberships enable row level security;
alter table public.gm_settings enable row level security;
alter table public.guest_profiles enable row level security;
alter table public.guest_stays enable row level security;
alter table public.guest_stay_rooms enable row level security;
alter table public.guest_notes enable row level security;
alter table public.guest_match_decisions enable row level security;
alter table public.guest_legacy_unresolved enable row level security;
alter table public.guest_legacy_sources enable row level security;
alter table public.guest_profile_merges enable row level security;

revoke all on all tables in schema public from anon,authenticated;
-- The grant above is intended for a fresh STAGING project only.
grant select on public.gm_hotels,public.gm_settings,public.gm_memberships,
  public.guest_profiles,public.guest_stays,public.guest_stay_rooms,
  public.guest_notes,public.guest_match_decisions,public.guest_legacy_unresolved,
  public.guest_profile_merges to authenticated;
grant insert,update on public.guest_notes to authenticated;

create policy gm_hotel_read on public.gm_hotels for select to authenticated
  using (guest_memory_private.role_for(id) in ('SERVICE','RECEPTION'));
create policy gm_settings_read on public.gm_settings for select to authenticated
  using (guest_memory_private.role_for(hotel_id) in ('SERVICE','RECEPTION'));
create policy gm_member_self on public.gm_memberships for select to authenticated
  using (user_id=(select auth.uid()) and guest_memory_private.role_for(hotel_id) in ('SERVICE','RECEPTION'));
create policy gm_profile_read on public.guest_profiles for select to authenticated
  using (guest_memory_private.can_see_profile(hotel_id,id));
create policy gm_stay_read on public.guest_stays for select to authenticated
  using (guest_memory_private.role_for(hotel_id) in ('SERVICE','RECEPTION'));
create policy gm_room_read on public.guest_stay_rooms for select to authenticated
  using (guest_memory_private.role_for(hotel_id) in ('SERVICE','RECEPTION'));
create policy gm_notes_read on public.guest_notes for select to authenticated
  using (deleted_at is null and guest_memory_private.role_for(hotel_id) in ('SERVICE','RECEPTION')
    and (note_type='STAY' or guest_memory_private.can_see_profile(hotel_id,guest_profile_id)));
create policy gm_notes_insert on public.guest_notes for insert to authenticated
  with check (guest_memory_private.role_for(hotel_id) in ('SERVICE','RECEPTION')
    and (note_type='STAY' or guest_memory_private.can_see_profile(hotel_id,guest_profile_id))
    and deleted_at is null);
create policy gm_notes_update on public.guest_notes for update to authenticated
  using (guest_memory_private.role_for(hotel_id) in ('SERVICE','RECEPTION')
    and (note_type='STAY' or guest_memory_private.can_see_profile(hotel_id,guest_profile_id)))
  with check (guest_memory_private.role_for(hotel_id) in ('SERVICE','RECEPTION')
    and (note_type='STAY' or guest_memory_private.can_see_profile(hotel_id,guest_profile_id))
    and (note_type='STAY' or deleted_at is null or guest_memory_private.role_for(hotel_id)='RECEPTION'));
create policy gm_decisions_read on public.guest_match_decisions for select to authenticated
  using (guest_memory_private.role_for(hotel_id)='RECEPTION');
create policy gm_legacy_read on public.guest_legacy_unresolved for select to authenticated
  using (guest_memory_private.role_for(hotel_id)='RECEPTION');
create policy gm_merge_read on public.guest_profile_merges for select to authenticated
  using (guest_memory_private.role_for(hotel_id)='RECEPTION');
