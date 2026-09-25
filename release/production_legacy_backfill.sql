-- REVIEW ONLY. Run after the schema and production hotel row have been approved.
-- Does not change breakfast_lists, breakfast_list or guest_preferences.
-- Re-audit the source counts before executing; fail closed if they changed.
begin;

do $$
declare
  v_hotel uuid;
  v_sources integer;
  item record;
  v_name text;
  v_normalized text;
  v_existing integer;
  v_stay uuid;
begin
  select id into strict v_hotel from public.gm_hotels
    where name = 'Ambassador Hotel Zürich';

  select count(*) into v_sources
  from public.breakfast_lists l
  cross join lateral jsonb_array_elements(l.payload->'rooms') room(value)
  where nullif(btrim(room.value->>'note'),'') is not null;
  if v_sources <> 11 then
    raise exception 'Production legacy source count changed: %, re-audit required', v_sources;
  end if;

  -- Seed stays only when a note comes from one named guest, dates cover its
  -- snapshot, and no second room in that snapshot has the same stay key.
  -- The existing idempotent backfill imports these notes as STAY; every
  -- remaining note is retained in guest_legacy_unresolved for reception.
  for item in
    select l.list_date, room.value as data
    from public.breakfast_lists l
    cross join lateral jsonb_array_elements(l.payload->'rooms') room(value)
    where nullif(btrim(room.value->>'note'),'') is not null
      and jsonb_typeof(room.value->'guests')='array'
      and jsonb_array_length(room.value->'guests')=1
      and nullif(btrim(room.value->'guests'->>0),'') is not null
      and (room.value->>'arrival') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and (room.value->>'departure') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and l.list_date between (room.value->>'arrival')::date
                          and (room.value->>'departure')::date
    order by l.list_date, (room.value->>'room')::integer
  loop
    v_name := btrim(item.data->'guests'->>0);
    v_normalized := lower(btrim(regexp_replace(normalize(v_name,NFKC),'[[:space:]]+',' ','g')));

    if exists (
      select 1 from public.breakfast_lists l
      cross join lateral jsonb_array_elements(l.payload->'rooms') other_room(value)
      cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(other_room.value->'guests')='array'
          then other_room.value->'guests' else '[]'::jsonb end
      ) other_guest(name)
      where l.list_date=item.list_date
        and other_room.value->>'room' <> item.data->>'room'
        and other_room.value->>'arrival'=item.data->>'arrival'
        and other_room.value->>'departure'=item.data->>'departure'
        and lower(btrim(regexp_replace(normalize(other_guest.name,NFKC),'[[:space:]]+',' ','g')))=v_normalized
    ) then continue; end if;

    select count(*),(array_agg(id))[1] into v_existing,v_stay from public.guest_stays
      where hotel_id=v_hotel and normalized_name=v_normalized
        and arrival_date=(item.data->>'arrival')::date
        and departure_date=(item.data->>'departure')::date;
    if v_existing>1 then continue; end if;
    if v_existing=0 then
      insert into public.guest_stays
        (hotel_id,original_name,normalized_name,arrival_date,departure_date,first_seen_on,last_seen_on)
      values(v_hotel,v_name,v_normalized,(item.data->>'arrival')::date,
        (item.data->>'departure')::date,item.list_date,item.list_date)
      returning id into v_stay;
    end if;
    insert into public.guest_stay_rooms
      (hotel_id,stay_id,room_number,first_seen_on,last_seen_on)
    values(v_hotel,v_stay,(item.data->>'room')::integer,item.list_date,item.list_date)
    on conflict (hotel_id,stay_id,room_number,first_seen_on) do nothing;
  end loop;
end $$;

select * from guest_memory_private.backfill_legacy_snapshot_notes(
  (select id from public.gm_hotels where name='Ambassador Hotel Zürich')
);

do $$
declare v_total integer; v_stay integer; v_unresolved integer;
begin
  select count(*),count(*) filter(where note_id is not null),
    count(*) filter(where unresolved_id is not null)
    into v_total,v_stay,v_unresolved
  from public.guest_legacy_sources
  where hotel_id=(select id from public.gm_hotels where name='Ambassador Hotel Zürich');
  if v_total<>11 or v_stay<>2 or v_unresolved<>9 then
    raise exception 'Legacy result changed: total %, STAY %, unresolved %; re-audit required',
      v_total,v_stay,v_unresolved;
  end if;
end $$;

-- Never promote a test hotel or test notes.
commit;
