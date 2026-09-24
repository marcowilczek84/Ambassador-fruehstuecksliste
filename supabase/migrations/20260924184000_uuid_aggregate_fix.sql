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
