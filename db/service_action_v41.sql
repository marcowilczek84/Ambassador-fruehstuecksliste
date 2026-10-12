-- Additive table-aware service actions. Existing v4 and merge APIs are retained.
CREATE OR REPLACE FUNCTION public.breakfast_service_action_v41(
 p_list_date date,p_room integer,p_expected jsonb,p_delta integer,p_action_id uuid,
 p_table text DEFAULT NULL,p_undo_action_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.breakfast_service_action_v41(date,integer,jsonb,integer,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.breakfast_service_action_v41(date,integer,jsonb,integer,uuid,text,uuid) TO anon,authenticated,service_role;
