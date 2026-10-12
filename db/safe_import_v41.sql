-- Atomic import that cannot reset current check-ins, table bookings or arrivals.
CREATE OR REPLACE FUNCTION public.breakfast_import_v41(p_list_date date,p_rooms jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.breakfast_import_v41(date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.breakfast_import_v41(date,jsonb) TO anon,authenticated,service_role;
