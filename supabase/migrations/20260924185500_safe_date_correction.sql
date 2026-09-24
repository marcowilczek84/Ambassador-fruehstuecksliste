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
