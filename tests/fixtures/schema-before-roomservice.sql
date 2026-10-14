-- Verified read-only from the existing database on 2026-10-14T21:02:10.414721+00:00.
-- Schema/functions only. NO guest data. For isolated tests exclusively.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.breakfast_lists(list_date date PRIMARY KEY,payload jsonb NOT NULL DEFAULT '{}',updated_at bigint NOT NULL DEFAULT 0);
ALTER TABLE public.breakfast_lists ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.breakfast_lists TO anon,authenticated,service_role;
CREATE POLICY qa_existing_access ON public.breakfast_lists TO anon,authenticated USING(true) WITH CHECK(true);
CREATE OR REPLACE FUNCTION public.breakfast_import_v41(p_list_date date, p_rooms jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE data jsonb; old jsonb; imported jsonb; merged jsonb:='[]'; count_now integer; now_ms bigint;
BEGIN
 IF p_list_date IS DISTINCT FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date OR jsonb_typeof(p_rooms)<>'array' THEN RAISE EXCEPTION 'Invalid import'; END IF;
 IF jsonb_array_length(p_rooms)<>44 OR (SELECT count(DISTINCT value->>'room') FROM jsonb_array_elements(p_rooms))<>44 THEN RAISE EXCEPTION 'Expected 44 unique rooms'; END IF;
 FOR imported IN SELECT value FROM jsonb_array_elements(p_rooms) LOOP
  IF (imported->>'room')::integer NOT IN (20,21,22,23,24,25,26,27,28,30,31,32,33,34,35,36,37,38,40,41,42,43,44,45,46,47,48,50,51,52,53,54,56,57,58,60,61,62,63,64,65,66,67,68)
  OR jsonb_typeof(imported->'guests') IS DISTINCT FROM 'array' OR jsonb_typeof(imported->'included') IS DISTINCT FROM 'boolean'
  OR (imported->>'people') IS NULL OR (imported->>'people')::integer<jsonb_array_length(imported->'guests') OR (imported->>'people')::integer<0 OR (imported->>'people')::integer>8
  OR ((imported->>'people')::integer>0 AND jsonb_array_length(imported->'guests')=0) THEN RAISE EXCEPTION 'Incomplete room data'; END IF;
 END LOOP;
 INSERT INTO public.breakfast_lists(list_date,payload,updated_at) VALUES(p_list_date,jsonb_build_object('date',p_list_date,'rooms','[]'::jsonb,'v8Arrivals','[]'::jsonb,'v8Activity','[]'::jsonb,'v8History','[]'::jsonb,'updated',0),0) ON CONFLICT(list_date) DO NOTHING;
 SELECT payload INTO data FROM public.breakfast_lists WHERE list_date=p_list_date FOR UPDATE;
 FOR imported IN SELECT value FROM jsonb_array_elements(p_rooms) LOOP
  SELECT value INTO old FROM jsonb_array_elements(data->'rooms') WHERE value->'room'=imported->'room';
  count_now:=COALESCE((old->>'arrivedCount')::integer,CASE WHEN COALESCE((old->>'present')::boolean,false) OR COALESCE((old->>'departed')::boolean,false) THEN (old->>'people')::integer ELSE 0 END,0);
  IF count_now>0 THEN
   IF old->'guests' IS DISTINCT FROM imported->'guests' OR (imported->>'people')::integer<count_now THEN RETURN jsonb_build_object('status','conflict','room',old->'room','payload',data); END IF;
   -- Preserve all attendance fields and existing notes; refresh only current stay/master data.
   imported:=old||jsonb_build_object('guests',imported->'guests','people',imported->'people','included',imported->'included','arrival',imported->'arrival','departure',imported->'departure');
  ELSE
   imported:=imported||jsonb_build_object('arrivedCount',0,'departedCount',0,'present',false,'departed',false,'table','','serviceBookings','[]'::jsonb);
  END IF;
  merged:=merged||jsonb_build_array(imported);
 END LOOP;
 now_ms:=GREATEST((extract(epoch from clock_timestamp())*1000)::bigint,COALESCE((data->>'updated')::bigint,0)+1);
 data:=data||jsonb_build_object('rooms',merged,'updated',now_ms);
 UPDATE public.breakfast_lists SET payload=data,updated_at=now_ms WHERE list_date=p_list_date;
 RETURN jsonb_build_object('status','saved','payload',data);
END $function$;

CREATE OR REPLACE FUNCTION public.breakfast_room_edit_v42(p_list_date date, p_room integer, p_expected jsonb, p_changes jsonb, p_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE data jsonb; current_room jsonb; changed jsonb; field text; now_ms bigint; people integer; count_now integer;
BEGIN
 IF p_list_date IS DISTINCT FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date
 OR p_room IS NULL OR p_action_id IS NULL OR jsonb_typeof(p_expected) IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_changes) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid room edit'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_changes) k WHERE k NOT IN ('guests','people','included','arrival','departure','note')) THEN RAISE EXCEPTION 'Only guest master data may be edited'; END IF;
 SELECT payload INTO data FROM public.breakfast_lists WHERE list_date=p_list_date FOR UPDATE;
 IF data IS NULL THEN RETURN jsonb_build_object('status','missing'); END IF;
 IF COALESCE(data->'v42RoomEdits','{}') ? p_action_id::text THEN RETURN jsonb_build_object('status','duplicate','payload',data); END IF;
 SELECT value INTO current_room FROM jsonb_array_elements(data->'rooms') WHERE (value->>'room')::integer=p_room;
 IF current_room IS NULL THEN RETURN jsonb_build_object('status','conflict','payload',data); END IF;
 FOREACH field IN ARRAY ARRAY['guests','people','included','arrival','departure','note'] LOOP
  IF COALESCE(current_room->field,'null'::jsonb) IS DISTINCT FROM COALESCE(p_expected->field,'null'::jsonb)
  THEN RETURN jsonb_build_object('status','conflict','payload',data); END IF;
 END LOOP;
 changed:=current_room||p_changes;
 IF jsonb_typeof(changed->'guests') IS DISTINCT FROM 'array' OR jsonb_typeof(changed->'included') IS DISTINCT FROM 'boolean'
 OR COALESCE(changed->>'people','') !~ '^[1-8]$' THEN RAISE EXCEPTION 'Invalid guest data'; END IF;
 people:=(changed->>'people')::integer;
 count_now:=COALESCE((current_room->>'arrivedCount')::integer,CASE WHEN COALESCE((current_room->>'present')::boolean,false) OR COALESCE((current_room->>'departed')::boolean,false) THEN (current_room->>'people')::integer ELSE 0 END,0);
 IF jsonb_array_length(changed->'guests')<1 OR jsonb_array_length(changed->'guests')>people
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(changed->'guests') g WHERE jsonb_typeof(g)<>'string' OR btrim(g#>>'{}')='')
 OR people<GREATEST(count_now,COALESCE((current_room->>'departedCount')::integer,0)) THEN RETURN jsonb_build_object('status','conflict','payload',data); END IF;
 IF NULLIF(changed->>'arrival','') IS NOT NULL AND NULLIF(changed->>'departure','') IS NOT NULL
 AND (changed->>'departure')::date<(changed->>'arrival')::date THEN RAISE EXCEPTION 'Departure precedes arrival'; END IF;
 now_ms:=GREATEST((extract(epoch from clock_timestamp())*1000)::bigint,COALESCE((data->>'updated')::bigint,0)+1);
 data:=data||jsonb_build_object('rooms',(SELECT jsonb_agg(CASE WHEN (value->>'room')::integer=p_room THEN changed ELSE value END ORDER BY ordinality) FROM jsonb_array_elements(data->'rooms') WITH ORDINALITY),
 'updated',now_ms,'v42RoomEdits',COALESCE(data->'v42RoomEdits','{}')||jsonb_build_object(p_action_id::text,true));
 UPDATE public.breakfast_lists SET payload=data,updated_at=now_ms WHERE list_date=p_list_date;
 RETURN jsonb_build_object('status','saved','payload',data);
END $function$;

CREATE OR REPLACE FUNCTION public.breakfast_service_action_v4(p_list_date date, p_room integer, p_expected jsonb, p_delta integer, p_action_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 data jsonb; current_room jsonb; changed_room jsonb; events jsonb; activity jsonb;
 count_now integer; people integer; new_count integer; now_ms bigint; operation jsonb;
BEGIN
 IF p_delta IS NULL OR p_delta NOT IN (-1,1) OR p_action_id IS NULL OR p_expected IS NULL
    OR jsonb_typeof(p_expected)<>'object' THEN RAISE EXCEPTION 'Invalid service action'; END IF;
 IF p_list_date<>(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date THEN
   RAISE EXCEPTION 'Only today can be changed';
 END IF;
 SELECT payload INTO data FROM public.breakfast_lists WHERE list_date=p_list_date FOR UPDATE;
 IF data IS NULL THEN RETURN jsonb_build_object('status','missing'); END IF;
 IF COALESCE(data->'v4ServiceActions','{}'::jsonb) ? p_action_id::text THEN
   RETURN jsonb_build_object('status','duplicate','payload',data);
 END IF;
 SELECT value INTO current_room FROM jsonb_array_elements(data->'rooms') WHERE (value->>'room')::integer=p_room;
 IF current_room IS NULL THEN RETURN jsonb_build_object('status','conflict','payload',data); END IF;
 -- Compare identity, entitlement and attendance; notes/table edits are preserved.
 IF current_room->'guests' IS DISTINCT FROM p_expected->'guests'
 OR current_room->'people' IS DISTINCT FROM p_expected->'people'
 OR current_room->'included' IS DISTINCT FROM p_expected->'included'
 OR COALESCE((current_room->>'arrivedCount')::integer,CASE WHEN COALESCE((current_room->>'present')::boolean,false) OR COALESCE((current_room->>'departed')::boolean,false) THEN (current_room->>'people')::integer ELSE 0 END)
    <>COALESCE((p_expected->>'arrivedCount')::integer,0) THEN
   RETURN jsonb_build_object('status','conflict','payload',data);
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(data->'v8History','[]'::jsonb)) WHERE value->>'date'=p_list_date::text) THEN
   RETURN jsonb_build_object('status','finished','payload',data);
 END IF;
 people:=COALESCE((current_room->>'people')::integer,0);
 count_now:=COALESCE((p_expected->>'arrivedCount')::integer,0); new_count:=count_now+p_delta;
 IF people<1 OR new_count<0 OR new_count>people OR jsonb_array_length(COALESCE(current_room->'guests','[]'::jsonb))=0 THEN
   RETURN jsonb_build_object('status','conflict','payload',data);
 END IF;
 now_ms:=GREATEST((extract(epoch from clock_timestamp())*1000)::bigint,COALESCE((data->>'updated')::bigint,0)+1);
 changed_room:=current_room||jsonb_build_object('arrivedCount',new_count,'departedCount',0,'present',new_count>0,'departed',false);
 events:=COALESCE(data->'v8Arrivals','[]'::jsonb);
 -- Negative corrections remain explicit events: legacy merging cannot resurrect a removed event.
 events:=events||jsonb_build_array(jsonb_build_object('room',p_room,'at',now_ms,'included',COALESCE((current_room->>'included')::boolean,false),'people',p_delta,'actionId',p_action_id::text));
 operation:=jsonb_build_object('id',p_action_id::text,'at',now_ms,'kind',CASE WHEN p_delta=1 THEN 'checkin' ELSE 'correction' END,'roomNumbers',jsonb_build_array(p_room),'people',p_delta,'beforeRooms',jsonb_build_array(current_room),'afterRooms',jsonb_build_array(changed_room),'label','Zimmer '||p_room||CASE WHEN p_delta=1 THEN ': 1 Person erfasst' ELSE ': 1 Person korrigiert' END);
 SELECT COALESCE(jsonb_agg(item ORDER BY ord),'[]'::jsonb) INTO activity FROM
 (SELECT value AS item,ordinality AS ord FROM jsonb_array_elements(COALESCE(data->'v8Activity','[]'::jsonb)||jsonb_build_array(operation)) WITH ORDINALITY ORDER BY ordinality DESC LIMIT 30) a;
 data:=data||jsonb_build_object('rooms',(SELECT jsonb_agg(CASE WHEN (value->>'room')::integer=p_room THEN changed_room ELSE value END ORDER BY ordinality) FROM jsonb_array_elements(data->'rooms') WITH ORDINALITY),'v8Arrivals',events,'v8Activity',activity,'updated',now_ms,'v4ServiceActions',COALESCE(data->'v4ServiceActions','{}'::jsonb)||jsonb_build_object(p_action_id::text,jsonb_build_object('room',p_room,'delta',p_delta)));
 UPDATE public.breakfast_lists SET payload=data,updated_at=now_ms WHERE list_date=p_list_date;
 RETURN jsonb_build_object('status','saved','payload',data);
END $function$;

CREATE OR REPLACE FUNCTION public.breakfast_service_action_v41(p_list_date date, p_room integer, p_expected jsonb, p_delta integer, p_action_id uuid, p_table text DEFAULT NULL::text, p_undo_action_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 data jsonb; r jsonb; changed jsonb; bookings jsonb; target jsonb; count_now integer;
 people integer; new_count integer; now_ms bigint; legacy_count integer; legacy_table text; table_text text;
BEGIN
 IF p_delta IS NULL OR p_delta=0 OR abs(p_delta)>8 OR p_action_id IS NULL OR p_expected IS NULL
 OR jsonb_typeof(p_expected)<>'object' OR p_list_date IS DISTINCT FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date THEN RAISE EXCEPTION 'Invalid service action'; END IF;
 IF p_delta>0 AND (p_table IS NULL OR p_table !~ '^Tisch ([1-9]|[1-4][0-9]|50)$') THEN RAISE EXCEPTION 'Choose a valid table'; END IF;
 SELECT payload INTO data FROM public.breakfast_lists WHERE list_date=p_list_date FOR UPDATE;
 IF data IS NULL THEN RETURN jsonb_build_object('status','missing'); END IF;
 IF COALESCE(data->'v4ServiceActions','{}') ? p_action_id::text THEN RETURN jsonb_build_object('status','duplicate','payload',data); END IF;
 SELECT value INTO r FROM jsonb_array_elements(data->'rooms') WHERE (value->>'room')::integer=p_room;
 IF r IS NULL THEN RETURN jsonb_build_object('status','conflict','payload',data); END IF;
 count_now:=COALESCE((r->>'arrivedCount')::integer,CASE WHEN COALESCE((r->>'present')::boolean,false) OR COALESCE((r->>'departed')::boolean,false) THEN (r->>'people')::integer ELSE 0 END);
 IF r->'guests' IS DISTINCT FROM p_expected->'guests' OR r->'people' IS DISTINCT FROM p_expected->'people'
 OR r->'included' IS DISTINCT FROM p_expected->'included' OR count_now<>COALESCE((p_expected->>'arrivedCount')::integer,0)
 OR COALESCE(r->'serviceBookings','[]') IS DISTINCT FROM COALESCE(p_expected->'serviceBookings','[]') THEN RETURN jsonb_build_object('status','conflict','payload',data); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(data->'v8History','[]')) WHERE value->>'date'=p_list_date::text) THEN RETURN jsonb_build_object('status','finished','payload',data); END IF;
 people:=COALESCE((r->>'people')::integer,0);new_count:=count_now+p_delta;
 IF people<1 OR new_count<0 OR new_count>people OR jsonb_array_length(COALESCE(r->'guests','[]'))=0 THEN RETURN jsonb_build_object('status','conflict','payload',data); END IF;
 bookings:=COALESCE(r->'serviceBookings','[]');
 legacy_count:=count_now-(SELECT COALESCE(sum((value->>'people')::integer),0) FROM jsonb_array_elements(bookings));
 legacy_table:=COALESCE(r->>'serviceLegacyTable',CASE WHEN jsonb_array_length(bookings)=0 THEN r->>'table' ELSE '' END,'');
 now_ms:=GREATEST((extract(epoch from clock_timestamp())*1000)::bigint,COALESCE((data->>'updated')::bigint,0)+1);
 IF p_delta>0 THEN
   bookings:=bookings||jsonb_build_array(jsonb_build_object('id',p_action_id,'people',p_delta,'table',p_table,'at',now_ms));
 ELSIF p_undo_action_id IS NOT NULL THEN
   SELECT value INTO target FROM jsonb_array_elements(bookings) WHERE value->>'id'=p_undo_action_id::text;
   IF target IS NULL OR (target->>'people')::integer<>-p_delta THEN RETURN jsonb_build_object('status','conflict','payload',data); END IF;
   SELECT COALESCE(jsonb_agg(value),'[]') INTO bookings FROM jsonb_array_elements(bookings) WHERE value->>'id'<>p_undo_action_id::text;
   p_table:=target->>'table';
 ELSE
   IF p_delta<>-1 OR legacy_count<1 THEN RETURN jsonb_build_object('status','conflict','payload',data); END IF;
   legacy_count:=legacy_count-1;p_table:=legacy_table;
 END IF;
 SELECT string_agg(name,' · ' ORDER BY name) INTO table_text FROM (
   SELECT DISTINCT value->>'table' AS name FROM jsonb_array_elements(bookings)
   UNION SELECT legacy_table WHERE legacy_count>0 AND legacy_table<>''
 ) t;
 changed:=r||jsonb_build_object('arrivedCount',new_count,'departedCount',0,'present',new_count>0,'departed',false,'serviceBookings',bookings,'serviceLegacyTable',CASE WHEN legacy_count>0 THEN legacy_table ELSE '' END,'table',COALESCE(table_text,''));
 data:=data||jsonb_build_object(
   'rooms',(SELECT jsonb_agg(CASE WHEN (value->>'room')::integer=p_room THEN changed ELSE value END ORDER BY ordinality) FROM jsonb_array_elements(data->'rooms') WITH ORDINALITY),
   'v8Arrivals',COALESCE(data->'v8Arrivals','[]')||jsonb_build_array(jsonb_build_object('room',p_room,'at',now_ms,'people',p_delta,'included',r->'included','table',p_table,'actionId',p_action_id,'undoActionId',p_undo_action_id)),
   'v8Activity',COALESCE(data->'v8Activity','[]')||jsonb_build_array(jsonb_build_object('id',p_action_id,'at',now_ms,'kind',CASE WHEN p_delta>0 THEN 'checkin' ELSE 'correction' END,'roomNumbers',jsonb_build_array(p_room),'people',p_delta,'table',p_table,'label','Zimmer '||p_room||': '||p_delta||' · '||COALESCE(p_table,''))),
   'updated',now_ms,'v4ServiceActions',COALESCE(data->'v4ServiceActions','{}')||jsonb_build_object(p_action_id::text,jsonb_build_object('room',p_room,'delta',p_delta,'table',p_table)));
 UPDATE public.breakfast_lists SET payload=data,updated_at=now_ms WHERE list_date=p_list_date;
 RETURN jsonb_build_object('status','saved','payload',data);
END $function$;
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
REVOKE ALL ON FUNCTION breakfast_import_v41(date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION breakfast_import_v41(date,jsonb) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION breakfast_room_edit_v42(date,integer,jsonb,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION breakfast_room_edit_v42(date,integer,jsonb,jsonb,uuid) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION breakfast_service_action_v4(date,integer,jsonb,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION breakfast_service_action_v4(date,integer,jsonb,integer,uuid) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION breakfast_service_action_v41(date,integer,jsonb,integer,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION breakfast_service_action_v41(date,integer,jsonb,integer,uuid,text,uuid) TO anon,authenticated,service_role;

