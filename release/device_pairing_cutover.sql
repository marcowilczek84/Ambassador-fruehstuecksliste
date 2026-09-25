-- Existing permissive policies remain for rollback, but these
-- restrictive policies AND them with an active, server-side device binding.
create policy gm_breakfast_device_guard on public.breakfast_lists as restrictive
 for all to anon,authenticated using(guest_memory_private.has_device())
 with check(guest_memory_private.has_device());

-- Production still exposes a legacy breakfast_list table via public policies.
-- Guard this table too; the Production read-only check found one row.
create policy gm_legacy_breakfast_device_guard on public.breakfast_list as restrictive
 for all to anon,authenticated using(guest_memory_private.has_device())
 with check(guest_memory_private.has_device());

-- Existing Production guest_preferences policies allow anon. Close them without
-- deleting data or destroying the old policies needed for a controlled rollback.
create policy gm_preferences_device_guard on public.guest_preferences as restrictive
 for all to anon,authenticated using(guest_memory_private.has_device())
 with check(guest_memory_private.has_device());

-- The existing merge RPC returns guest data; RLS must also be checked before
-- any read or mutation inside it, including its ON CONFLICT path.
CREATE OR REPLACE FUNCTION public.merge_breakfast_changes(p_list_date date, p_rooms jsonb DEFAULT '[]'::jsonb, p_arrivals jsonb DEFAULT '[]'::jsonb, p_history jsonb DEFAULT NULL::jsonb, p_activity jsonb DEFAULT '[]'::jsonb, p_updated bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  current_payload jsonb;
  current_rooms jsonb;
  current_arrivals jsonb;
  current_activity jsonb;
  merged_rooms jsonb;
  merged_arrivals jsonb;
  merged_activity jsonb;
  merged_history jsonb;
  result_payload jsonb;
begin
  if not guest_memory_private.has_device() then
    raise exception 'device not authorized' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_rooms, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_arrivals, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_activity, '[]'::jsonb)) <> 'array' then
    raise exception 'rooms, arrivals and activity must be JSON arrays';
  end if;

  insert into public.breakfast_lists (list_date, payload, updated_at)
  values (
    p_list_date,
    jsonb_build_object(
      'date', p_list_date::text,
      'rooms', '[]'::jsonb,
      'v8Arrivals', '[]'::jsonb,
      'v8History', coalesce(p_history, '[]'::jsonb),
      'v8Activity', '[]'::jsonb,
      'updated', greatest(p_updated, 0)
    ),
    greatest(p_updated, 0)
  )
  on conflict (list_date) do nothing;

  select payload
    into current_payload
    from public.breakfast_lists
   where list_date = p_list_date
   for update;

  current_payload := coalesce(current_payload, '{}'::jsonb);
  current_rooms := case when jsonb_typeof(current_payload->'rooms') = 'array' then current_payload->'rooms' else '[]'::jsonb end;
  current_arrivals := case when jsonb_typeof(current_payload->'v8Arrivals') = 'array' then current_payload->'v8Arrivals' else '[]'::jsonb end;
  current_activity := case when jsonb_typeof(current_payload->'v8Activity') = 'array' then current_payload->'v8Activity' else '[]'::jsonb end;

  select coalesce(jsonb_agg(room_item order by (room_item->>'room')::integer), '[]'::jsonb)
    into merged_rooms
    from (
      select existing.room_item
        from jsonb_array_elements(current_rooms) as existing(room_item)
       where not exists (
         select 1
           from jsonb_array_elements(coalesce(p_rooms, '[]'::jsonb)) as changed(room_item)
          where changed.room_item->>'room' = existing.room_item->>'room'
       )
      union all
      select changed.room_item
        from jsonb_array_elements(coalesce(p_rooms, '[]'::jsonb)) as changed(room_item)
    ) merged;

  select coalesce(jsonb_agg(arrival_item order by coalesce((arrival_item->>'at')::bigint, 0)), '[]'::jsonb)
    into merged_arrivals
    from (
      select distinct arrival_item
        from jsonb_array_elements(current_arrivals || coalesce(p_arrivals, '[]'::jsonb)) as arrivals(arrival_item)
    ) deduplicated_arrivals;

  select coalesce(jsonb_agg(activity_item order by activity_at), '[]'::jsonb)
    into merged_activity
    from (
      select activity_item, activity_at
        from (
          select distinct on (activity_item->>'id')
                 activity_item,
                 coalesce((activity_item->>'at')::bigint, 0) as activity_at
            from jsonb_array_elements(current_activity || coalesce(p_activity, '[]'::jsonb)) as activities(activity_item)
           order by activity_item->>'id', coalesce((activity_item->>'at')::bigint, 0) desc
        ) unique_activity
       order by activity_at desc
       limit 30
    ) recent_activity;

  merged_history := case
    when p_history is not null and jsonb_typeof(p_history) = 'array' then p_history
    when jsonb_typeof(current_payload->'v8History') = 'array' then current_payload->'v8History'
    else '[]'::jsonb
  end;

  result_payload := current_payload || jsonb_build_object(
    'date', p_list_date::text,
    'rooms', merged_rooms,
    'v8Arrivals', merged_arrivals,
    'v8History', merged_history,
    'v8Activity', merged_activity,
    'updated', greatest(p_updated, coalesce((current_payload->>'updated')::bigint, 0))
  );

  update public.breakfast_lists
     set payload = result_payload,
         updated_at = greatest(p_updated, updated_at)
   where list_date = p_list_date;

  return result_payload;
end;
$function$;
revoke execute on function public.merge_breakfast_changes(date,jsonb,jsonb,jsonb,jsonb,bigint) from anon;
grant execute on function public.merge_breakfast_changes(date,jsonb,jsonb,jsonb,jsonb,bigint) to authenticated;

-- Upserting the current stay is normal synchronization, not an identity merge.
create or replace function guest_memory_private.require_role(p_hotel uuid,p_reception boolean default false)
returns text language plpgsql stable security definer set search_path='' as $$
begin
 if not guest_memory_private.device_hotel(p_hotel) or p_reception then
   raise exception 'guest-memory permission denied' using errcode='42501';
 end if;
 return 'SERVICE';
end $$;
-- Preserve the original stay collision and date-correction behavior while allowing
-- both work areas to synchronize a stay with the same paired-device rights.
create or replace function public.gm_upsert_stay(
 p_hotel uuid,p_name text,p_arrival date,p_departure date,p_room integer,p_seen date
) returns uuid language plpgsql security definer set search_path='' as $$
declare normalized text; found_stay uuid; candidate_count int; continued uuid;
begin
 perform guest_memory_private.require_role(p_hotel,false);
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

create or replace function public.gm_upsert_stay_checked(
 p_hotel uuid,p_name text,p_arrival date,p_departure date,p_room integer,
 p_seen date,p_same_name_rooms integer[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare normalized text; previous_stay uuid; previous_rooms integer[]; result_id uuid;
begin
 perform guest_memory_private.require_role(p_hotel,false);
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

create or replace function public.gm_soft_delete_note(p_note uuid) returns void
language plpgsql security definer set search_path='' as $$
declare n public.guest_notes%rowtype; r text;
begin
 select * into n from public.guest_notes where id=p_note for update;
 if not found then raise exception 'unknown note'; end if;
 r:=guest_memory_private.require_role(n.hotel_id,false);
 if r='SERVICE' and n.note_type='STAY' and not guest_memory_private.can_read_stay(n.hotel_id,n.stay_id) then
   raise exception 'only current stay notes are editable';
 end if;
 perform pg_catalog.set_config('guest_memory.note_delete','enabled',true);
 update public.guest_notes set deleted_at=clock_timestamp() where id=n.id and deleted_at is null;
end $$;

revoke execute on function public.gm_decide_match(uuid,uuid,boolean),
 public.gm_merge_profiles(uuid,uuid),public.gm_restore_merge(uuid),
 public.gm_assign_legacy(uuid,uuid),public.gm_discard_legacy(uuid),
 public.gm_correct_stay_dates(uuid,date,date) from public,anon,authenticated;
