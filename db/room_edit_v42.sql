-- Additive master-data save. Attendance always comes from the locked current row.
CREATE OR REPLACE FUNCTION public.breakfast_room_edit_v42(
 p_list_date date,p_room integer,p_expected jsonb,p_changes jsonb,p_action_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.breakfast_room_edit_v42(date,integer,jsonb,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.breakfast_room_edit_v42(date,integer,jsonb,jsonb,uuid) TO anon,authenticated,service_role;
