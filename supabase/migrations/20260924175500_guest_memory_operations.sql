-- Staging-first operations. All privileged entry points check the server-side membership.
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
