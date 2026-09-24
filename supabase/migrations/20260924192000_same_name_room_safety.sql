-- STAGING ONLY. A complete same-name room snapshot distinguishes simultaneous
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
