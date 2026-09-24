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
