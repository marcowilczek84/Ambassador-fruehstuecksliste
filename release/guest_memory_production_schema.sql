-- PREPARED RELEASE CANDIDATE. DO NOT EXECUTE BEFORE EXPLICIT PRODUCTION APPROVAL.
-- Additive guest-memory schema. Does not modify existing breakfast/tip tables or create accounts.
-- All statements belong to one reviewed deployment step.

begin;

-- Source: 20260924174500_guest_memory_schema.sql
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

-- A production hotel record is required before any device code can be issued.
-- This UUID belongs only to Production; no Staging hotel row or test data is copied.
insert into public.gm_hotels(id,name)
values ('417b5dcf-8aab-4e57-b3f4-ad4085c16e43','Ambassador Hotel Zürich');
insert into public.gm_settings(hotel_id)
values ('417b5dcf-8aab-4e57-b3f4-ad4085c16e43');

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

-- Source: 20260924175500_guest_memory_operations.sql
-- Privileged entry points check the server-side membership.
create function guest_memory_private.require_role(p_hotel uuid,p_reception boolean default false)
returns text language plpgsql stable security definer set search_path='' as $$
declare r text;
begin
 r := guest_memory_private.role_for(p_hotel);
 if r is null or (p_reception and r <> 'RECEPTION') then
   raise exception 'guest-memory permission denied' using errcode='42501';
 end if;
 return r;
end $$;
revoke all on function guest_memory_private.require_role(uuid,boolean) from public,anon;
grant execute on function guest_memory_private.require_role(uuid,boolean) to authenticated;

create function public.gm_upsert_stay(
 p_hotel uuid,p_name text,p_arrival date,p_departure date,p_room integer,p_seen date
) returns uuid language plpgsql security definer set search_path='' as $$
declare normalized text; found_stay uuid; candidate_count int; continued uuid;
begin
 perform guest_memory_private.require_role(p_hotel,true);
 normalized := lower(btrim(regexp_replace(normalize(p_name,NFKC),'[[:space:]]+',' ','g')));
 if length(normalized)=0 or p_arrival is null or p_departure<p_arrival
    or p_seen is null or p_room not between 1 and 9999 then
   raise exception 'invalid stay' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_hotel::text||normalized,0));
 select count(*),min(s.id) into candidate_count,found_stay
 from public.guest_stays s where s.hotel_id=p_hotel and s.normalized_name=normalized
   and s.arrival_date=p_arrival and s.departure_date=p_departure
   and s.last_seen_on>=p_arrival;
 if candidate_count>1 then
   select s.id into continued from public.guest_stays s
   join public.guest_stay_rooms r on r.stay_id=s.id and r.hotel_id=p_hotel
   where s.hotel_id=p_hotel and s.normalized_name=normalized
     and s.arrival_date=p_arrival and s.departure_date=p_departure
     and r.room_number=p_room
   order by r.last_seen_on desc limit 1;
   if continued is null then raise exception 'ambiguous same-name stay' using errcode='P0003'; end if;
   found_stay:=continued;
 elsif candidate_count=0 then
   -- A changed date must not silently create a second identity with orphaned notes.
   select count(*),min(s.id) into candidate_count,continued
   from public.guest_stays s
   join public.guest_stay_rooms r on r.stay_id=s.id and r.hotel_id=p_hotel
   where s.hotel_id=p_hotel and s.normalized_name=normalized and r.room_number=p_room
     and s.arrival_date<=p_seen and s.departure_date>=p_seen
     and s.last_seen_on>=p_seen-interval '2 days';
   if candidate_count=1 then
     -- Date edits are shown for explicit Reception review, preserving the existing stay.
     update public.guest_stays set match_state=case when guest_profile_id is null
         then 'REVIEW_REQUIRED' else match_state end where id=continued;
     raise exception 'date correction requires reception review: %',continued using errcode='P0004';
   elsif candidate_count>1 then
     raise exception 'ambiguous stay correction' using errcode='P0003';
   end if;
   insert into public.guest_stays(hotel_id,original_name,normalized_name,arrival_date,departure_date,first_seen_on,last_seen_on)
   values(p_hotel,btrim(p_name),normalized,p_arrival,p_departure,p_seen,p_seen)
   returning id into found_stay;
 end if;
 update public.guest_stays set last_seen_on=greatest(last_seen_on,p_seen),updated_at=now()
 where id=found_stay;
 insert into public.guest_stay_rooms(hotel_id,stay_id,room_number,first_seen_on,last_seen_on)
 values(p_hotel,found_stay,p_room,p_seen,p_seen)
 on conflict(hotel_id,stay_id,room_number,first_seen_on)
 do update set last_seen_on=greatest(guest_stay_rooms.last_seen_on,excluded.last_seen_on);
 return found_stay;
end $$;

create function public.gm_create_profile_for_stay(p_stay uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.guest_stays%rowtype; profile uuid;
begin
 select * into s from public.guest_stays where id=p_stay for update;
 if not found then raise exception 'unknown stay'; end if;
 perform guest_memory_private.require_role(s.hotel_id,false);
 if s.guest_profile_id is not null then return s.guest_profile_id; end if;
 insert into public.guest_profiles(hotel_id,display_name,normalized_name)
 values(s.hotel_id,s.original_name,s.normalized_name) returning id into profile;
 update public.guest_stays set guest_profile_id=profile,match_state='CONFIRMED',updated_at=now()
 where id=s.id;
 return profile;
end $$;

create function public.gm_decide_match(p_stay uuid,p_profile uuid,p_same_person boolean)
returns void language plpgsql security definer set search_path='' as $$
declare s public.guest_stays%rowtype; p public.guest_profiles%rowtype;
begin
 select * into s from public.guest_stays where id=p_stay for update;
 select * into p from public.guest_profiles where id=p_profile for update;
 if s.id is null or p.id is null or s.hotel_id<>p.hotel_id or p.merged_into is not null then
   raise exception 'invalid stay/profile pair';
 end if;
 perform guest_memory_private.require_role(s.hotel_id,true);
 if exists(select 1 from public.guest_match_decisions d where d.stay_id=s.id
           and d.candidate_profile_id=p.id and d.decision='REJECTED' and p_same_person) then
   raise exception 'previously rejected candidate requires separate review';
 end if;
 if p_same_person then
   if s.guest_profile_id is not null and s.guest_profile_id<>p.id then
     raise exception 'stay already linked: use reviewed profile merge';
   end if;
   update public.guest_stays set guest_profile_id=p.id,match_state='CONFIRMED',updated_at=now()
   where id=s.id;
 else
   if s.guest_profile_id=p.id then raise exception 'cannot reject active profile'; end if;
 end if;
 insert into public.guest_match_decisions(hotel_id,stay_id,candidate_profile_id,decision)
 values(s.hotel_id,s.id,p.id,case when p_same_person then 'CONFIRMED' else 'REJECTED' end)
 on conflict(stay_id,candidate_profile_id) do update set decision=excluded.decision,
 decided_at=now();
end $$;

create function public.gm_soft_delete_note(p_note uuid) returns void
language plpgsql security definer set search_path='' as $$
declare n public.guest_notes%rowtype; r text;
begin
 select * into n from public.guest_notes where id=p_note for update;
 if not found then raise exception 'unknown note'; end if;
 r:=guest_memory_private.require_role(n.hotel_id,n.note_type='PERSISTENT');
 if r='SERVICE' and n.note_type='STAY' and not exists(
   select 1 from public.guest_stays s where s.id=n.stay_id
   and s.arrival_date<=(now() at time zone 'Europe/Zurich')::date
   and s.departure_date>=(now() at time zone 'Europe/Zurich')::date) then
   raise exception 'only current stay notes are editable';
 end if;
 update public.guest_notes set deleted_at=clock_timestamp() where id=n.id and deleted_at is null;
end $$;

create function public.gm_merge_profiles(p_source uuid,p_target uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare src public.guest_profiles%rowtype; dst public.guest_profiles%rowtype;
 snapshot jsonb; merge_id uuid;
begin
 if p_source=p_target then raise exception 'source and target must differ'; end if;
 -- Deterministic lock order prevents opposite concurrent merges from deadlocking.
 perform 1 from public.guest_profiles where id in(p_source,p_target) order by id for update;
 select * into src from public.guest_profiles where id=p_source;
 select * into dst from public.guest_profiles where id=p_target;
 if src.id is null or dst.id is null or src.hotel_id<>dst.hotel_id
   or src.merged_into is not null or dst.merged_into is not null then
   raise exception 'profiles unavailable for merge';
 end if;
 perform guest_memory_private.require_role(src.hotel_id,true);
 if exists(select 1 from public.guest_stays s
           join public.guest_match_decisions d on d.stay_id=s.id
           where s.guest_profile_id=p_source and d.candidate_profile_id=p_target
             and d.decision='REJECTED')
    or exists(select 1 from public.guest_match_decisions d
      where d.candidate_profile_id=p_source and exists (
        select 1 from public.guest_match_decisions other
        where other.stay_id=d.stay_id and other.candidate_profile_id=p_target)) then
   raise exception 'matching decision conflict; review before merge';
 end if;
 select pg_catalog.jsonb_build_object(
   'stays',coalesce((select pg_catalog.jsonb_agg(id) from public.guest_stays where guest_profile_id=p_source),'[]'::jsonb),
   'notes',coalesce((select pg_catalog.jsonb_agg(id) from public.guest_notes where guest_profile_id=p_source),'[]'::jsonb),
   'decisions',coalesce((select pg_catalog.jsonb_agg(id) from public.guest_match_decisions where candidate_profile_id=p_source),'[]'::jsonb)
 ) into snapshot;
 perform pg_catalog.set_config('guest_memory.profile_merge','enabled',true);
 update public.guest_stays set guest_profile_id=p_target where guest_profile_id=p_source;
 update public.guest_notes set guest_profile_id=p_target where guest_profile_id=p_source;
 update public.guest_match_decisions set candidate_profile_id=p_target
 where candidate_profile_id=p_source;
 update public.guest_profiles set merged_into=p_target,updated_at=now() where id=p_source;
 insert into public.guest_profile_merges(hotel_id,source_profile_id,target_profile_id,snapshot)
 values(src.hotel_id,p_source,p_target,snapshot) returning id into merge_id;
 return merge_id;
end $$;

create function public.gm_restore_merge(p_merge uuid) returns void
language plpgsql security definer set search_path='' as $$
declare m public.guest_profile_merges%rowtype; ids uuid[]; n uuid;
begin
 select * into m from public.guest_profile_merges where id=p_merge for update;
 if m.id is null or m.restored_at is not null then raise exception 'merge not restorable'; end if;
 perform guest_memory_private.require_role(m.hotel_id,true);
 perform 1 from public.guest_profiles where id in(m.source_profile_id,m.target_profile_id)
 order by id for update;
 if (select merged_into from public.guest_profiles where id=m.source_profile_id)<>m.target_profile_id then
   raise exception 'source merged again; manual review required';
 end if;
 -- Abort if post-merge records refer to the source or the moved notes changed.
 if exists(select 1 from public.guest_notes n where n.id in(
      select value::uuid from pg_catalog.jsonb_array_elements_text(m.snapshot->'notes'))
      and n.updated_at>m.merged_at) then
    raise exception 'notes changed after merge; manual recovery required';
 end if;
 perform pg_catalog.set_config('guest_memory.profile_merge','enabled',true);
 update public.guest_stays s set guest_profile_id=m.source_profile_id
 where s.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(m.snapshot->'stays'))
   and s.guest_profile_id=m.target_profile_id;
 update public.guest_notes n set guest_profile_id=m.source_profile_id
 where n.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(m.snapshot->'notes'))
   and n.guest_profile_id=m.target_profile_id;
 update public.guest_match_decisions d set candidate_profile_id=m.source_profile_id
 where d.id in(select value::uuid from pg_catalog.jsonb_array_elements_text(m.snapshot->'decisions'))
   and d.candidate_profile_id=m.target_profile_id;
 update public.guest_profiles set merged_into=null,updated_at=now()
 where id=m.source_profile_id;
 update public.guest_profile_merges set restored_at=clock_timestamp() where id=m.id;
end $$;

create function public.gm_assign_legacy(p_legacy uuid,p_stay uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare legacy public.guest_legacy_unresolved%rowtype; stay public.guest_stays%rowtype; v_new_note uuid;
begin
 select * into legacy from public.guest_legacy_unresolved where id=p_legacy for update;
 select * into stay from public.guest_stays where id=p_stay;
 if legacy.id is null or stay.id is null or legacy.hotel_id<>stay.hotel_id
   or legacy.assignment_status<>'UNRESOLVED' then raise exception 'invalid legacy assignment'; end if;
 perform guest_memory_private.require_role(legacy.hotel_id,true);
 insert into public.guest_notes(hotel_id,note_type,stay_id,body)
 values(legacy.hotel_id,'STAY',stay.id,legacy.original_body) returning id into v_new_note;
 update public.guest_legacy_unresolved set assignment_status='ASSIGNED',
 resolved_stay_id=stay.id,resolved_at=now() where id=legacy.id;
 update public.guest_legacy_sources set note_id=v_new_note,unresolved_id=null
 where hotel_id=legacy.hotel_id and source_key=legacy.source_key;
 return v_new_note;
end $$;

-- New functions default to EXECUTE for PUBLIC. Revoke before granting to authenticated.
revoke all on function public.gm_upsert_stay(uuid,text,date,date,integer,date),
 public.gm_create_profile_for_stay(uuid),public.gm_decide_match(uuid,uuid,boolean),
 public.gm_soft_delete_note(uuid),public.gm_merge_profiles(uuid,uuid),
 public.gm_restore_merge(uuid),public.gm_assign_legacy(uuid,uuid) from public,anon;
grant execute on function public.gm_upsert_stay(uuid,text,date,date,integer,date),
 public.gm_create_profile_for_stay(uuid),public.gm_decide_match(uuid,uuid,boolean),
 public.gm_soft_delete_note(uuid),public.gm_merge_profiles(uuid,uuid),
 public.gm_restore_merge(uuid),public.gm_assign_legacy(uuid,uuid) to authenticated;

-- Source: 20260924181000_guest_memory_hardening.sql
create function guest_memory_private.can_read_stay(p_hotel uuid,p_stay uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select guest_memory_private.role_for(p_hotel)='RECEPTION' or
  (guest_memory_private.role_for(p_hotel)='SERVICE' and exists(
    select 1 from public.guest_stays s where s.id=p_stay and s.hotel_id=p_hotel
    and s.arrival_date<=(now() at time zone 'Europe/Zurich')::date
    and s.departure_date>=(now() at time zone 'Europe/Zurich')::date))
$$;
revoke all on function guest_memory_private.can_read_stay(uuid,uuid) from public,anon;
grant execute on function guest_memory_private.can_read_stay(uuid,uuid) to authenticated;

drop policy gm_stay_read on public.guest_stays;
create policy gm_stay_read on public.guest_stays for select to authenticated
 using(guest_memory_private.can_read_stay(hotel_id,id));
drop policy gm_room_read on public.guest_stay_rooms;
create policy gm_room_read on public.guest_stay_rooms for select to authenticated
 using(guest_memory_private.can_read_stay(hotel_id,stay_id));
drop policy gm_notes_read on public.guest_notes;
create policy gm_notes_read on public.guest_notes for select to authenticated
 using(deleted_at is null and
  ((note_type='STAY' and guest_memory_private.can_read_stay(hotel_id,stay_id))
   or (note_type='PERSISTENT' and guest_memory_private.can_see_profile(hotel_id,guest_profile_id))));
drop policy gm_notes_insert on public.guest_notes;
create policy gm_notes_insert on public.guest_notes for insert to authenticated
 with check(deleted_at is null and
  ((note_type='STAY' and guest_memory_private.can_read_stay(hotel_id,stay_id))
   or (note_type='PERSISTENT' and guest_memory_private.can_see_profile(hotel_id,guest_profile_id))));
drop policy gm_notes_update on public.guest_notes;
create policy gm_notes_update on public.guest_notes for update to authenticated
 using((note_type='STAY' and guest_memory_private.can_read_stay(hotel_id,stay_id))
   or (note_type='PERSISTENT' and guest_memory_private.can_see_profile(hotel_id,guest_profile_id)))
 with check(deleted_at is null and
  ((note_type='STAY' and guest_memory_private.can_read_stay(hotel_id,stay_id))
   or (note_type='PERSISTENT' and guest_memory_private.can_see_profile(hotel_id,guest_profile_id))));

create or replace function guest_memory_private.note_timestamp() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if old.created_at is distinct from new.created_at
      or old.hotel_id is distinct from new.hotel_id
      or old.note_type is distinct from new.note_type
      or old.stay_id is distinct from new.stay_id
      or (old.guest_profile_id is distinct from new.guest_profile_id
          and current_setting('guest_memory.profile_merge',true)<>'enabled')
      or (old.deleted_at is distinct from new.deleted_at
          and current_setting('guest_memory.note_delete',true)<>'enabled') then
     raise exception 'note identity/deletion cannot be changed directly';
   end if;
   new.created_at:=old.created_at;
   new.updated_at:=case when old.body is distinct from new.body
                            or old.deleted_at is distinct from new.deleted_at
                        then clock_timestamp() else old.updated_at end;
 end if;
 return new;
end $$;

create or replace function public.gm_soft_delete_note(p_note uuid) returns void
language plpgsql security definer set search_path='' as $$
declare n public.guest_notes%rowtype; r text;
begin
 select * into n from public.guest_notes where id=p_note for update;
 if not found then raise exception 'unknown note'; end if;
 r:=guest_memory_private.require_role(n.hotel_id,n.note_type='PERSISTENT');
 if r='SERVICE' and n.note_type='STAY' and not guest_memory_private.can_read_stay(n.hotel_id,n.stay_id) then
   raise exception 'only current stay notes are editable';
 end if;
 perform pg_catalog.set_config('guest_memory.note_delete','enabled',true);
 update public.guest_notes set deleted_at=clock_timestamp() where id=n.id and deleted_at is null;
end $$;

create or replace function public.gm_create_profile_for_stay(p_stay uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.guest_stays%rowtype; profile uuid; r text;
begin
 select * into s from public.guest_stays where id=p_stay for update;
 if not found then raise exception 'unknown stay'; end if;
 r:=guest_memory_private.require_role(s.hotel_id,false);
 if r='SERVICE' and not guest_memory_private.can_read_stay(s.hotel_id,s.id) then
   raise exception 'service cannot create a profile for an old stay';
 end if;
 if s.guest_profile_id is not null then return s.guest_profile_id; end if;
 insert into public.guest_profiles(hotel_id,display_name,normalized_name)
 values(s.hotel_id,s.original_name,s.normalized_name) returning id into profile;
 update public.guest_stays set guest_profile_id=profile,match_state='CONFIRMED',updated_at=now()
 where id=s.id;
 return profile;
end $$;

create function public.gm_correct_stay_dates(p_stay uuid,p_arrival date,p_departure date)
returns void language plpgsql security definer set search_path='' as $$
declare s public.guest_stays%rowtype;
begin
 select * into s from public.guest_stays where id=p_stay for update;
 if s.id is null or p_arrival is null or p_departure<p_arrival then
   raise exception 'invalid date correction';
 end if;
 perform guest_memory_private.require_role(s.hotel_id,true);
 update public.guest_stays set arrival_date=p_arrival,departure_date=p_departure,
   match_state=case when guest_profile_id is null then 'UNLINKED' else 'CONFIRMED' end,
   updated_at=now() where id=s.id;
end $$;
revoke all on function public.gm_correct_stay_dates(uuid,date,date) from public,anon;
grant execute on function public.gm_correct_stay_dates(uuid,date,date) to authenticated;

-- Source: 20260924183000_guest_memory_backfill.sql
create function guest_memory_private.backfill_legacy_snapshot_notes(p_hotel uuid)
returns table(imported integer,unresolved integer,already_seen integer)
language plpgsql security definer set search_path='' as $$
declare rec record; key text; n text; stay_id uuid; note_id uuid; unresolved_id uuid;
 candidates int; existing_note uuid; i int:=0; u int:=0; skipped int:=0;
begin
 if current_user not in ('postgres','supabase_admin') then
   raise exception 'admin-only legacy backfill' using errcode='42501';
 end if;
 if not exists(select 1 from public.gm_hotels where id=p_hotel) then
   raise exception 'unknown hotel';
 end if;
 for rec in
   select b.list_date,room.value as room
   from public.breakfast_lists b
   cross join lateral pg_catalog.jsonb_array_elements(b.payload->'rooms') room(value)
   where nullif(btrim(room.value->>'note'),'') is not null
   order by b.list_date,(room.value->>'room')::integer
 loop
   key:=rec.list_date::text||':'||(rec.room->>'room')||':'||
     pg_catalog.md5(rec.room->>'note');
   if exists(select 1 from public.guest_legacy_sources where hotel_id=p_hotel and source_key=key) then
     skipped:=skipped+1; continue;
   end if;
   n:=null;
   if pg_catalog.jsonb_typeof(rec.room->'guests')='array'
      and pg_catalog.jsonb_array_length(rec.room->'guests')=1 then
     n:=rec.room->'guests'->>0;
   end if;
   stay_id:=null; candidates:=0;
   if nullif(btrim(coalesce(n,'')),'') is not null
      and coalesce(rec.room->>'arrival','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and coalesce(rec.room->>'departure','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
     select count(*),(array_agg(s.id))[1] into candidates,stay_id from public.guest_stays s
      where s.hotel_id=p_hotel
        and s.normalized_name=lower(btrim(regexp_replace(normalize(n,NFKC),'[[:space:]]+',' ','g')))
        and s.arrival_date=(rec.room->>'arrival')::date
        and s.departure_date=(rec.room->>'departure')::date;
   end if;
   if candidates=1 then
     select gn.id into existing_note from public.guest_notes gn
     where gn.hotel_id=p_hotel and gn.stay_id=stay_id and gn.note_type='STAY'
       and gn.body=rec.room->>'note' and gn.deleted_at is null
     order by gn.created_at limit 1;
     if existing_note is null then
       insert into public.guest_notes(hotel_id,stay_id,note_type,body)
       values(p_hotel,stay_id,'STAY',rec.room->>'note') returning id into existing_note;
       i:=i+1;
     end if;
     insert into public.guest_legacy_sources(hotel_id,source_key,note_id)
       values(p_hotel,key,existing_note);
   else
     insert into public.guest_legacy_unresolved(hotel_id,source_key,original_body,observed_on,room_number)
       values(p_hotel,key,rec.room->>'note',rec.list_date,(rec.room->>'room')::integer)
       returning id into unresolved_id;
     insert into public.guest_legacy_sources(hotel_id,source_key,unresolved_id)
       values(p_hotel,key,unresolved_id);
     u:=u+1;
   end if;
 end loop;
 return query select i,u,skipped;
end $$;
revoke all on function guest_memory_private.backfill_legacy_snapshot_notes(uuid) from public,anon,authenticated;

-- Run by a protected scheduler with administrative credentials; never expose to clients.
create function guest_memory_private.purge_expired(p_hotel uuid)
returns table(notes_purged integer,stays_purged integer)
language plpgsql security definer set search_path='' as $$
declare n integer; s integer; cfg public.gm_settings%rowtype;
begin
 if current_user not in ('postgres','supabase_admin') then
   raise exception 'admin-only retention job' using errcode='42501';
 end if;
 select * into cfg from public.gm_settings where hotel_id=p_hotel;
 if cfg.hotel_id is null then raise exception 'hotel configuration missing'; end if;
 -- Source provenance must remain self-contained when old note records are purged.
 delete from public.guest_legacy_sources src using public.guest_notes note
   where src.note_id=note.id and note.hotel_id=p_hotel
     and note.deleted_at<now()-make_interval(days=>cfg.deleted_note_days);
 delete from public.guest_notes where hotel_id=p_hotel and deleted_at is not null
   and deleted_at<now()-make_interval(days=>cfg.deleted_note_days);
 get diagnostics n=row_count;
 -- Keep unresolved legacy records until consciously reviewed; never silently purge.
 delete from public.guest_match_decisions d using public.guest_stays stay
   where d.stay_id=stay.id and stay.hotel_id=p_hotel
   and stay.departure_date<(now() at time zone 'Europe/Zurich')::date
      -make_interval(months=>cfg.stay_history_months);
 delete from public.guest_legacy_sources src using public.guest_notes note,public.guest_stays stay
   where src.note_id=note.id and note.stay_id=stay.id and stay.hotel_id=p_hotel
     and stay.departure_date<(now() at time zone 'Europe/Zurich')::date
       -make_interval(months=>cfg.stay_history_months);
 delete from public.guest_legacy_sources src using public.guest_legacy_unresolved legacy
   where src.unresolved_id=legacy.id and legacy.hotel_id=p_hotel
     and legacy.assignment_status='ASSIGNED' and legacy.resolved_stay_id in(
       select id from public.guest_stays where hotel_id=p_hotel
       and departure_date<(now() at time zone 'Europe/Zurich')::date
         -make_interval(months=>cfg.stay_history_months));
 delete from public.guest_legacy_unresolved legacy where legacy.hotel_id=p_hotel
   and legacy.assignment_status='ASSIGNED' and legacy.resolved_stay_id in(
       select id from public.guest_stays where hotel_id=p_hotel
       and departure_date<(now() at time zone 'Europe/Zurich')::date
         -make_interval(months=>cfg.stay_history_months));
 delete from public.guest_notes note using public.guest_stays stay
   where note.stay_id=stay.id and stay.hotel_id=p_hotel and note.note_type='STAY'
     and stay.departure_date<(now() at time zone 'Europe/Zurich')::date
       -make_interval(months=>cfg.stay_history_months);
 delete from public.guest_stays where hotel_id=p_hotel
   and departure_date<(now() at time zone 'Europe/Zurich')::date
     -make_interval(months=>cfg.stay_history_months)
   and not exists(select 1 from public.guest_legacy_unresolved legacy
                  where legacy.resolved_stay_id=guest_stays.id);
 get diagnostics s=row_count;
 return query select n,s;
end $$;
revoke all on function guest_memory_private.purge_expired(uuid) from public,anon,authenticated;

-- Source: 20260924184000_uuid_aggregate_fix.sql
-- PostgreSQL UUIDs have no min() aggregate.
create or replace function public.gm_upsert_stay(
 p_hotel uuid,p_name text,p_arrival date,p_departure date,p_room integer,p_seen date
) returns uuid language plpgsql security definer set search_path='' as $$
declare normalized text; found_stay uuid; candidate_count int; continued uuid;
begin
 perform guest_memory_private.require_role(p_hotel,true);
 normalized := lower(btrim(regexp_replace(normalize(p_name,NFKC),'[[:space:]]+',' ','g')));
 if length(normalized)=0 or p_arrival is null or p_departure<p_arrival
    or p_seen is null or p_room not between 1 and 9999 then
   raise exception 'invalid stay' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_hotel::text||normalized,0));
 select count(*),(array_agg(s.id))[1] into candidate_count,found_stay
 from public.guest_stays s where s.hotel_id=p_hotel and s.normalized_name=normalized
   and s.arrival_date=p_arrival and s.departure_date=p_departure
   and s.last_seen_on>=p_arrival;
 if candidate_count>1 then
   select s.id into continued from public.guest_stays s
   join public.guest_stay_rooms r on r.stay_id=s.id and r.hotel_id=p_hotel
   where s.hotel_id=p_hotel and s.normalized_name=normalized
     and s.arrival_date=p_arrival and s.departure_date=p_departure
     and r.room_number=p_room
   order by r.last_seen_on desc limit 1;
   if continued is null then raise exception 'ambiguous same-name stay' using errcode='P0003'; end if;
   found_stay:=continued;
 elsif candidate_count=0 then
   -- A changed date must not silently create a second identity with orphaned notes.
   select count(*),(array_agg(s.id))[1] into candidate_count,continued
   from public.guest_stays s
   join public.guest_stay_rooms r on r.stay_id=s.id and r.hotel_id=p_hotel
   where s.hotel_id=p_hotel and s.normalized_name=normalized and r.room_number=p_room
     and s.arrival_date<=p_seen and s.departure_date>=p_seen
     and s.last_seen_on>=p_seen-interval '2 days';
   if candidate_count=1 then
     -- Date edits are shown for explicit Reception review, preserving the existing stay.
     update public.guest_stays set match_state=case when guest_profile_id is null
         then 'REVIEW_REQUIRED' else match_state end where id=continued;
     raise exception 'date correction requires reception review: %',continued using errcode='P0004';
   elsif candidate_count>1 then
     raise exception 'ambiguous stay correction' using errcode='P0003';
   end if;
   insert into public.guest_stays(hotel_id,original_name,normalized_name,arrival_date,departure_date,first_seen_on,last_seen_on)
   values(p_hotel,btrim(p_name),normalized,p_arrival,p_departure,p_seen,p_seen)
   returning id into found_stay;
 end if;
 update public.guest_stays set last_seen_on=greatest(last_seen_on,p_seen),updated_at=now()
 where id=found_stay;
 insert into public.guest_stay_rooms(hotel_id,stay_id,room_number,first_seen_on,last_seen_on)
 values(p_hotel,found_stay,p_room,p_seen,p_seen)
 on conflict(hotel_id,stay_id,room_number,first_seen_on)
 do update set last_seen_on=greatest(guest_stay_rooms.last_seen_on,excluded.last_seen_on);
 return found_stay;
end $$;

create or replace function guest_memory_private.backfill_legacy_snapshot_notes(p_hotel uuid)
returns table(imported integer,unresolved integer,already_seen integer)
language plpgsql security definer set search_path='' as $$
declare rec record; key text; n text; stay_id uuid; note_id uuid; unresolved_id uuid;
 candidates int; existing_note uuid; i int:=0; u int:=0; skipped int:=0;
begin
 if current_user not in ('postgres','supabase_admin') then
   raise exception 'admin-only legacy backfill' using errcode='42501';
 end if;
 if not exists(select 1 from public.gm_hotels where id=p_hotel) then
   raise exception 'unknown hotel';
 end if;
 for rec in
   select b.list_date,room.value as room
   from public.breakfast_lists b
   cross join lateral pg_catalog.jsonb_array_elements(b.payload->'rooms') room(value)
   where nullif(btrim(room.value->>'note'),'') is not null
   order by b.list_date,(room.value->>'room')::integer
 loop
   key:=rec.list_date::text||':'||(rec.room->>'room')||':'||
     pg_catalog.md5(rec.room->>'note');
   if exists(select 1 from public.guest_legacy_sources where hotel_id=p_hotel and source_key=key) then
     skipped:=skipped+1; continue;
   end if;
   n:=null;
   if pg_catalog.jsonb_typeof(rec.room->'guests')='array'
      and pg_catalog.jsonb_array_length(rec.room->'guests')=1 then
     n:=rec.room->'guests'->>0;
   end if;
   stay_id:=null; candidates:=0;
   if nullif(btrim(coalesce(n,'')),'') is not null
      and coalesce(rec.room->>'arrival','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and coalesce(rec.room->>'departure','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
     select count(*),(array_agg(s.id))[1] into candidates,stay_id from public.guest_stays s
      where s.hotel_id=p_hotel
        and s.normalized_name=lower(btrim(regexp_replace(normalize(n,NFKC),'[[:space:]]+',' ','g')))
        and s.arrival_date=(rec.room->>'arrival')::date
        and s.departure_date=(rec.room->>'departure')::date;
   end if;
   if candidates=1 then
     select gn.id into existing_note from public.guest_notes gn
     where gn.hotel_id=p_hotel and gn.stay_id=stay_id and gn.note_type='STAY'
       and gn.body=rec.room->>'note' and gn.deleted_at is null
     order by gn.created_at limit 1;
     if existing_note is null then
       insert into public.guest_notes(hotel_id,stay_id,note_type,body)
       values(p_hotel,stay_id,'STAY',rec.room->>'note') returning id into existing_note;
       i:=i+1;
     end if;
     insert into public.guest_legacy_sources(hotel_id,source_key,note_id)
       values(p_hotel,key,existing_note);
   else
     insert into public.guest_legacy_unresolved(hotel_id,source_key,original_body,observed_on,room_number)
       values(p_hotel,key,rec.room->>'note',rec.list_date,(rec.room->>'room')::integer)
       returning id into unresolved_id;
     insert into public.guest_legacy_sources(hotel_id,source_key,unresolved_id)
       values(p_hotel,key,unresolved_id);
     u:=u+1;
   end if;
 end loop;
 return query select i,u,skipped;
end $$;

-- Source: 20260924185000_backfill_scope_fix.sql
-- Avoid ambiguity between the PL/pgSQL variable and note column.
create or replace function guest_memory_private.backfill_legacy_snapshot_notes(p_hotel uuid)
returns table(imported integer,unresolved integer,already_seen integer)
language plpgsql security definer set search_path='' as $$
declare rec record; key text; n text; v_stay uuid; note_id uuid; unresolved_id uuid;
 candidates int; existing_note uuid; i int:=0; u int:=0; skipped int:=0;
begin
 if current_user not in ('postgres','supabase_admin') then
   raise exception 'admin-only legacy backfill' using errcode='42501';
 end if;
 if not exists(select 1 from public.gm_hotels where id=p_hotel) then
   raise exception 'unknown hotel';
 end if;
 for rec in
   select b.list_date,room.value as room
   from public.breakfast_lists b
   cross join lateral pg_catalog.jsonb_array_elements(b.payload->'rooms') room(value)
   where nullif(btrim(room.value->>'note'),'') is not null
   order by b.list_date,(room.value->>'room')::integer
 loop
   key:=rec.list_date::text||':'||(rec.room->>'room')||':'||
     pg_catalog.md5(rec.room->>'note');
   if exists(select 1 from public.guest_legacy_sources where hotel_id=p_hotel and source_key=key) then
     skipped:=skipped+1; continue;
   end if;
   n:=null;
   if pg_catalog.jsonb_typeof(rec.room->'guests')='array'
      and pg_catalog.jsonb_array_length(rec.room->'guests')=1 then
     n:=rec.room->'guests'->>0;
   end if;
   v_stay:=null; candidates:=0;
   if nullif(btrim(coalesce(n,'')),'') is not null
      and coalesce(rec.room->>'arrival','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and coalesce(rec.room->>'departure','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
     select count(*),(array_agg(s.id))[1] into candidates,v_stay from public.guest_stays s
      where s.hotel_id=p_hotel
        and s.normalized_name=lower(btrim(regexp_replace(normalize(n,NFKC),'[[:space:]]+',' ','g')))
        and s.arrival_date=(rec.room->>'arrival')::date
        and s.departure_date=(rec.room->>'departure')::date;
   end if;
   if candidates=1 then
     select gn.id into existing_note from public.guest_notes gn
     where gn.hotel_id=p_hotel and gn.stay_id=v_stay and gn.note_type='STAY'
       and gn.body=rec.room->>'note' and gn.deleted_at is null
     order by gn.created_at limit 1;
     if existing_note is null then
       insert into public.guest_notes(hotel_id,stay_id,note_type,body)
       values(p_hotel,v_stay,'STAY',rec.room->>'note') returning id into existing_note;
       i:=i+1;
     end if;
     insert into public.guest_legacy_sources(hotel_id,source_key,note_id)
       values(p_hotel,key,existing_note);
   else
     insert into public.guest_legacy_unresolved(hotel_id,source_key,original_body,observed_on,room_number)
       values(p_hotel,key,rec.room->>'note',rec.list_date,(rec.room->>'room')::integer)
       returning id into unresolved_id;
     insert into public.guest_legacy_sources(hotel_id,source_key,unresolved_id)
       values(p_hotel,key,unresolved_id);
     u:=u+1;
   end if;
 end loop;
 return query select i,u,skipped;
end $$;

-- Source: 20260924185500_safe_date_correction.sql
-- Keep the same UUID when same guest/room/overlapping stay uniquely proves a date correction.
-- PostgreSQL UUIDs have no min() aggregate.
create or replace function public.gm_upsert_stay(
 p_hotel uuid,p_name text,p_arrival date,p_departure date,p_room integer,p_seen date
) returns uuid language plpgsql security definer set search_path='' as $$
declare normalized text; found_stay uuid; candidate_count int; continued uuid;
begin
 perform guest_memory_private.require_role(p_hotel,true);
 normalized := lower(btrim(regexp_replace(normalize(p_name,NFKC),'[[:space:]]+',' ','g')));
 if length(normalized)=0 or p_arrival is null or p_departure<p_arrival
    or p_seen is null or p_room not between 1 and 9999 then
   raise exception 'invalid stay' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_hotel::text||normalized,0));
 select count(*),(array_agg(s.id))[1] into candidate_count,found_stay
 from public.guest_stays s where s.hotel_id=p_hotel and s.normalized_name=normalized
   and s.arrival_date=p_arrival and s.departure_date=p_departure
   and s.last_seen_on>=p_arrival;
 if candidate_count>1 then
   select s.id into continued from public.guest_stays s
   join public.guest_stay_rooms r on r.stay_id=s.id and r.hotel_id=p_hotel
   where s.hotel_id=p_hotel and s.normalized_name=normalized
     and s.arrival_date=p_arrival and s.departure_date=p_departure
     and r.room_number=p_room
   order by r.last_seen_on desc limit 1;
   if continued is null then raise exception 'ambiguous same-name stay' using errcode='P0003'; end if;
   found_stay:=continued;
 elsif candidate_count=0 then
   -- A changed date must not silently create a second identity with orphaned notes.
   select count(*),(array_agg(s.id))[1] into candidate_count,continued
   from public.guest_stays s
   join public.guest_stay_rooms r on r.stay_id=s.id and r.hotel_id=p_hotel
   where s.hotel_id=p_hotel and s.normalized_name=normalized and r.room_number=p_room
     and s.arrival_date<=p_seen and s.departure_date>=p_seen
     and s.last_seen_on>=p_seen-interval '2 days';
   if candidate_count=1 then
     -- Same normalized guest in the same room and overlapping stay: safe date correction.
     update public.guest_stays set arrival_date=p_arrival,departure_date=p_departure,
       original_name=btrim(p_name),last_seen_on=greatest(last_seen_on,p_seen),updated_at=now()
     where id=continued;
     found_stay:=continued;
   elsif candidate_count>1 then
     raise exception 'ambiguous stay correction' using errcode='P0003';
   end if;
   if candidate_count=0 then
     insert into public.guest_stays(hotel_id,original_name,normalized_name,arrival_date,departure_date,first_seen_on,last_seen_on)
     values(p_hotel,btrim(p_name),normalized,p_arrival,p_departure,p_seen,p_seen)
     returning id into found_stay;
   end if;
 end if;
 update public.guest_stays set last_seen_on=greatest(last_seen_on,p_seen),updated_at=now()
 where id=found_stay;
 insert into public.guest_stay_rooms(hotel_id,stay_id,room_number,first_seen_on,last_seen_on)
 values(p_hotel,found_stay,p_room,p_seen,p_seen)
 on conflict(hotel_id,stay_id,room_number,first_seen_on)
 do update set last_seen_on=greatest(guest_stay_rooms.last_seen_on,excluded.last_seen_on);
 return found_stay;
end $$;

-- Source: 20260924190000_guest_memory_retention_schedule.sql
create extension if not exists pg_cron with schema extensions;

create function guest_memory_private.purge_all_expired()
returns void language plpgsql security definer set search_path = '' as $$
declare h record;
begin
  for h in select id from public.gm_hotels loop
    perform guest_memory_private.purge_expired(h.id);
  end loop;
end $$;
revoke all on function guest_memory_private.purge_all_expired() from public, anon, authenticated;

select cron.schedule('ambassador-gm-production-retention','15 3 * * *',
  'select guest_memory_private.purge_all_expired()');

-- Source: 20260924191000_legacy_review_actions.sql
create function public.gm_discard_legacy(p_legacy uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare item public.guest_legacy_unresolved%rowtype;
begin
  select * into item from public.guest_legacy_unresolved where id=p_legacy for update;
  if item.id is null or item.assignment_status <> 'UNRESOLVED' then
    raise exception 'unresolved legacy note not found';
  end if;
  perform guest_memory_private.require_role(item.hotel_id,true);
  update public.guest_legacy_unresolved
  set assignment_status='DELETED',resolved_at=clock_timestamp()
  where id=item.id;
end $$;
revoke all on function public.gm_discard_legacy(uuid) from public, anon;
grant execute on function public.gm_discard_legacy(uuid) to authenticated;

-- Source: 20260924192000_same_name_room_safety.sql
-- guests from a room move. Old six-argument imports are no longer exposed.
create function public.gm_upsert_stay_checked(
 p_hotel uuid,p_name text,p_arrival date,p_departure date,p_room integer,
 p_seen date,p_same_name_rooms integer[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare normalized text; previous_stay uuid; previous_rooms integer[]; result_id uuid;
begin
 perform guest_memory_private.require_role(p_hotel,true);
 if p_name is null or p_same_name_rooms is null or p_room is null
    or not (p_room=any(p_same_name_rooms)) or
    p_same_name_rooms is distinct from (
      select array_agg(distinct v order by v) from unnest(p_same_name_rooms) v)
    or array_length(p_same_name_rooms,1)>100 then
   raise exception 'complete same-name room snapshot required' using errcode='22023';
 end if;
 normalized:=lower(btrim(regexp_replace(normalize(p_name,NFKC),'[[:space:]]+',' ','g')));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_hotel::text||normalized,0));
 select s.id into previous_stay from public.guest_stays s
 where s.hotel_id=p_hotel and s.normalized_name=normalized
   and s.arrival_date=p_arrival and s.departure_date=p_departure
   and s.last_seen_on>=p_arrival
 order by s.id limit 1;
 if previous_stay is not null and not exists(
   select 1 from public.guest_stay_rooms r join public.guest_stays s on s.id=r.stay_id
   where s.hotel_id=p_hotel and s.normalized_name=normalized
     and s.arrival_date=p_arrival and s.departure_date=p_departure
     and r.room_number=p_room
 ) then
   select array_agg(distinct r.room_number) into previous_rooms
   from public.guest_stay_rooms r where r.stay_id=previous_stay;
   if previous_rooms && p_same_name_rooms then
     insert into public.guest_stays
       (hotel_id,original_name,normalized_name,arrival_date,departure_date,first_seen_on,last_seen_on)
     values(p_hotel,btrim(p_name),normalized,p_arrival,p_departure,p_seen,p_seen)
     returning id into result_id;
     insert into public.guest_stay_rooms(hotel_id,stay_id,room_number,first_seen_on,last_seen_on)
     values(p_hotel,result_id,p_room,p_seen,p_seen);
     return result_id;
   end if;
 end if;
 return public.gm_upsert_stay(p_hotel,p_name,p_arrival,p_departure,p_room,p_seen);
end $$;
revoke all on function public.gm_upsert_stay_checked(uuid,text,date,date,integer,date,integer[]) from public,anon;
grant execute on function public.gm_upsert_stay_checked(uuid,text,date,date,integer,date,integer[]) to authenticated;
revoke execute on function public.gm_upsert_stay(uuid,text,date,date,integer,date) from authenticated;

-- First production release: the work-area selector is not an authorization boundary.
-- Identity decisions, profile merges/restores and legacy assignments remain unavailable
-- even to a client that calls these RPCs directly. Revisit only after a separate
-- server-side authorization decision and migration.
revoke execute on function public.gm_decide_match(uuid,uuid,boolean),
 public.gm_merge_profiles(uuid,uuid), public.gm_restore_merge(uuid),
 public.gm_assign_legacy(uuid,uuid), public.gm_discard_legacy(uuid),
 public.gm_correct_stay_dates(uuid,date,date) from authenticated, anon, public;

commit;
