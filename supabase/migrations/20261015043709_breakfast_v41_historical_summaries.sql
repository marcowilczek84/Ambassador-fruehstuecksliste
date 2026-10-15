BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Narrow aggregate-only lookup. No room payload, guest identity or mutable table
-- access is returned. Callable only by the non-login executor after authorization.
CREATE FUNCTION bf41_security.week_summaries() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH summaries AS (
  SELECT DISTINCT ON (h->>'date') h FROM bf41_data.breakfast_lists b CROSS JOIN LATERAL jsonb_array_elements(coalesce(b.payload->'v8History','[]')) h
  WHERE b.list_date BETWEEN (now() AT TIME ZONE 'Europe/Zurich')::date-7 AND (now() AT TIME ZONE 'Europe/Zurich')::date
   AND h->>'date' BETWEEN ((now() AT TIME ZONE 'Europe/Zurich')::date-6)::text AND ((now() AT TIME ZONE 'Europe/Zurich')::date)::text
  ORDER BY h->>'date',b.list_date DESC,b.updated_at DESC
 ) SELECT coalesce(jsonb_agg((SELECT jsonb_object_agg(k,v) FROM jsonb_each(h) x(k,v) WHERE k IN ('date','includedExpected','includedArrived','includedMissing','hotelAdditional','opera','external','additional','total','first','last','peak','eighty')) ORDER BY h->>'date'),'[]') FROM summaries
$$;
REVOKE ALL ON FUNCTION bf41_security.week_summaries() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bf41_security.week_summaries() TO bf41_executor;
GRANT CREATE ON SCHEMA bf41_security TO bf41_executor;
SET LOCAL ROLE bf41_executor;
CREATE FUNCTION bf41_security.effective_arrivals(p_events jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb:='[]'; e jsonb; candidate jsonb; remaining integer; removed integer; i integer;
BEGIN
 FOR e IN SELECT value FROM jsonb_array_elements(coalesce(p_events,'[]')) ORDER BY (value->>'at')::bigint LOOP
  IF (e->>'people')::integer>0 THEN result:=result||jsonb_build_array(e); CONTINUE; END IF;
  remaining:=-coalesce((e->>'people')::integer,0);i:=jsonb_array_length(result)-1;
  WHILE i>=0 AND remaining>0 LOOP
   candidate:=result->i;
   IF candidate->'room'=e->'room' AND (CASE WHEN nullif(e->>'undoActionId','') IS NOT NULL THEN candidate->>'actionId'=e->>'undoActionId' ELSE candidate->'included'=e->'included' END) THEN
    removed:=least(remaining,(candidate->>'people')::integer);remaining:=remaining-removed;
    result:=jsonb_set(result,ARRAY[i::text,'people'],to_jsonb((candidate->>'people')::integer-removed));
   END IF;i:=i-1;
  END LOOP;
 END LOOP;
 RETURN (SELECT coalesce(jsonb_agg(value),'[]') FROM jsonb_array_elements(result) WHERE (value->>'people')::integer>0);
END $$;
REVOKE ALL ON FUNCTION bf41_security.effective_arrivals(jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION bf41_security.read_day(p_list_date date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE r text; result jsonb;
BEGIN
 r:=bf41_security.authorize('read',p_list_date);
 SELECT bf41_security.project_payload(payload,r) INTO result FROM bf41_data.breakfast_lists WHERE list_date=p_list_date;
 IF result IS NOT NULL AND r IN ('reception','admin') AND p_list_date=(now() AT TIME ZONE 'Europe/Zurich')::date THEN result:=jsonb_set(result,'{v8History}',bf41_security.week_summaries()); END IF;
 RETURN jsonb_build_object('status',CASE WHEN result IS NULL THEN 'missing' ELSE 'ok' END,'payload',result,'role',r);
END $body$;
CREATE OR REPLACE FUNCTION bf41_security.project_payload(p_payload jsonb,p_role text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $body$
 SELECT (CASE WHEN p_payload IS NULL THEN NULL WHEN p_role='admin' THEN p_payload-'v4ServiceActions'-'v42RoomEdits'-'bf41Actions' ELSE
 jsonb_build_object('date',p_payload->'date',
  'rooms',(SELECT coalesce(jsonb_agg((SELECT jsonb_object_agg(k,v) FROM jsonb_each(room) AS x(k,v)
   WHERE k IN ('room','people','guests','included','arrivedCount','departedCount','present','departed','table','serviceBookings','serviceLegacyTable','arrival','departure','note')) ORDER BY ord),'[]')
   FROM jsonb_array_elements(coalesce(p_payload->'rooms','[]')) WITH ORDINALITY AS r(room,ord)),
  'updated',p_payload->'updated',
  'v8Arrivals',(SELECT coalesce(jsonb_agg(e ORDER BY ord),'[]') FROM jsonb_array_elements(coalesce(p_payload->'v8Arrivals','[]')) WITH ORDINALITY a(e,ord)
   WHERE CASE WHEN e->>'at' ~ '^[0-9]{1,15}$' THEN (to_timestamp((e->>'at')::double precision/1000) AT TIME ZONE 'Europe/Zurich')::date::text=p_payload->>'date' ELSE false END),
  'v8Activity',(SELECT coalesce(jsonb_agg(e ORDER BY ord),'[]') FROM jsonb_array_elements(coalesce(p_payload->'v8Activity','[]')) WITH ORDINALITY a(e,ord)
   WHERE CASE WHEN e->>'at' ~ '^[0-9]{1,15}$' THEN (to_timestamp((e->>'at')::double precision/1000) AT TIME ZONE 'Europe/Zurich')::date::text=p_payload->>'date' ELSE false END),
  'v8History',(SELECT coalesce(jsonb_agg((SELECT jsonb_object_agg(k,v) FROM jsonb_each(h) x(k,v) WHERE k IN ('date','includedExpected','includedArrived','includedMissing','hotelAdditional','opera','external','additional','total','first','last','peak','eighty'))),'[]') FROM jsonb_array_elements(coalesce(p_payload->'v8History','[]')) h WHERE h->>'date'=p_payload->>'date' OR p_role='reception')) END) || CASE WHEN p_payload IS NOT NULL AND p_role IN ('reception','admin') AND p_payload->>'date'=(now() AT TIME ZONE 'Europe/Zurich')::date::text THEN
 jsonb_build_object('v8History',
  (SELECT coalesce(jsonb_agg(h),'[]') FROM jsonb_array_elements(bf41_security.week_summaries()) h WHERE h->>'date'<>p_payload->>'date') ||
  (SELECT coalesce(jsonb_agg((SELECT jsonb_object_agg(k,v) FROM jsonb_each(h) x(k,v) WHERE k IN ('date','includedExpected','includedArrived','includedMissing','hotelAdditional','opera','external','additional','total','first','last','peak','eighty'))),'[]') FROM jsonb_array_elements(coalesce(p_payload->'v8History','[]')) h WHERE h->>'date'=p_payload->>'date')) ELSE '{}'::jsonb END
$body$;
CREATE OR REPLACE FUNCTION bf41_security.workflow(p_list_date date,p_kind text,p_data jsonb,p_action_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text; data jsonb; now_ms bigint; events jsonb; item jsonb; target jsonb; changed jsonb; current_room jsonb;
 people integer; typ text; tbl text; rooms jsonb; snapshot jsonb; expected_count integer; arrived integer; hotel_extra integer; opera integer; external_count integer;
BEGIN
 r:=bf41_security.authorize(p_kind,p_list_date);
 IF p_kind NOT IN ('special','depart','close','reopen','clear') OR p_action_id IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text)>65536 THEN RAISE EXCEPTION 'Invalid workflow action'; END IF;
 SELECT payload INTO data FROM bf41_data.breakfast_lists WHERE list_date=p_list_date FOR UPDATE;
 IF data IS NULL THEN RETURN jsonb_build_object('status','missing'); END IF;
 IF coalesce(data->'bf41Actions','{}') ? p_action_id::text THEN RETURN jsonb_build_object('status','duplicate','payload',bf41_security.project_payload(data,r)); END IF;
 IF p_kind NOT IN ('reopen','close') AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(data->'v8History','[]')) h WHERE h->>'date'=p_list_date::text) THEN RETURN jsonb_build_object('status','finished','payload',bf41_security.project_payload(data,r)); END IF;
 now_ms:=greatest((extract(epoch FROM clock_timestamp())*1000)::bigint,coalesce((data->>'updated')::bigint,0)+1);
 IF p_kind='special' THEN
  IF p_data ? 'undo_id' THEN
   SELECT e INTO target FROM jsonb_array_elements(coalesce(data->'v8Arrivals','[]')) e WHERE e->>'actionId'=p_data->>'undo_id' AND e->>'guestType' IN ('opera','external') AND (e->>'people')::integer>0;
   IF target IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(data->'v8Arrivals','[]')) e WHERE e->>'undoActionId'=p_data->>'undo_id') THEN RETURN jsonb_build_object('status','conflict','payload',bf41_security.project_payload(data,r)); END IF;
   item:=target||jsonb_build_object('people',-(target->>'people')::integer,'at',now_ms,'actionId',p_action_id,'undoActionId',target->>'actionId');
  ELSE
   typ:=p_data->>'guest_type';people:=(p_data->>'people')::integer;tbl:=p_data->>'table';
   IF typ IS NULL OR typ NOT IN ('opera','external') OR people IS NULL OR people<1 OR people>20 OR tbl IS NULL OR tbl !~ '^(Tisch ([1-9]|[1-4][0-9]|50)|Kein Tisch)$' THEN RAISE EXCEPTION 'Invalid special guest'; END IF;
   item:=jsonb_build_object('room',CASE WHEN typ='opera' THEN -1 ELSE -2 END,'at',now_ms,'included',false,'people',people,'table',tbl,'guestType',typ,'actionId',p_action_id);
  END IF;
  data:=data||jsonb_build_object('v8Arrivals',coalesce(data->'v8Arrivals','[]')||jsonb_build_array(item),
   'v8Activity',coalesce(data->'v8Activity','[]')||jsonb_build_array(jsonb_build_object('id',p_action_id,'at',now_ms,'kind',CASE WHEN item ? 'undoActionId' THEN 'correction' ELSE 'checkin' END,'roomNumbers','[]'::jsonb,'guestType',item->>'guestType','people',item->'people','table',item->>'table','targetId',item->>'undoActionId','label','Sondergast')));
 ELSIF p_kind='depart' THEN
  rooms:=data->'rooms';
  IF jsonb_typeof(p_data->'rooms') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'rooms')<1 OR jsonb_array_length(p_data->'rooms')>44 THEN RAISE EXCEPTION 'Invalid departure'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_data->'rooms') LOOP
   SELECT value INTO current_room FROM jsonb_array_elements(rooms) WHERE value->'room'=item->'room';
   IF current_room IS NULL OR current_room->'guests' IS DISTINCT FROM item->'guests' OR coalesce((current_room->>'arrivedCount')::integer,0)<>coalesce((item->>'arrivedCount')::integer,-1) OR coalesce((current_room->>'departedCount')::integer,0)<>coalesce((item->>'departedCount')::integer,-1) THEN RETURN jsonb_build_object('status','conflict','payload',bf41_security.project_payload(data,r)); END IF;
   people:=(current_room->>'arrivedCount')::integer;
   changed:=current_room||jsonb_build_object('departedCount',people,'present',false,'departed',people>0);
   SELECT jsonb_agg(CASE WHEN value->'room'=item->'room' THEN changed ELSE value END ORDER BY ordinality) INTO rooms FROM jsonb_array_elements(rooms) WITH ORDINALITY;
  END LOOP;
  data:=data||jsonb_build_object('rooms',rooms);
 ELSE
  IF coalesce((p_data->>'expected_updated')::bigint,-1)<>coalesce((data->>'updated')::bigint,0) THEN RETURN jsonb_build_object('status','conflict','payload',bf41_security.project_payload(data,r)); END IF;
  IF p_kind='clear' THEN
   IF jsonb_array_length(coalesce(data->'v8Arrivals','[]'))>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(data->'rooms') x WHERE coalesce((x->>'arrivedCount')::integer,0)>0) THEN RAISE EXCEPTION 'A day with bookings cannot be cleared'; END IF;
   SELECT jsonb_agg(jsonb_build_object('room',x->'room','people',0,'guests','[]'::jsonb,'included',true,'arrivedCount',0,'departedCount',0,'present',false,'departed',false,'table','','serviceBookings','[]'::jsonb) ORDER BY ordinality) INTO rooms FROM jsonb_array_elements(data->'rooms') WITH ORDINALITY a(x,ordinality);
   data:=data||jsonb_build_object('rooms',rooms);
  ELSIF p_kind='reopen' THEN
   data:=jsonb_set(data,'{v8History}',(SELECT coalesce(jsonb_agg(h),'[]') FROM jsonb_array_elements(coalesce(data->'v8History','[]')) h WHERE h->>'date'<>p_list_date::text));
  ELSE
   SELECT coalesce(sum((x->>'people')::integer) FILTER(WHERE (x->>'included')::boolean),0),coalesce(sum(coalesce((x->>'arrivedCount')::integer,0)) FILTER(WHERE (x->>'included')::boolean),0),coalesce(sum(coalesce((x->>'arrivedCount')::integer,0)) FILTER(WHERE NOT (x->>'included')::boolean),0) INTO expected_count,arrived,hotel_extra FROM jsonb_array_elements(data->'rooms') x;
   SELECT greatest(coalesce(sum((x->>'people')::integer) FILTER(WHERE x->>'guestType'='opera'),0),0),greatest(coalesce(sum((x->>'people')::integer) FILTER(WHERE x->>'guestType'='external'),0),0) INTO opera,external_count FROM jsonb_array_elements(coalesce(data->'v8Arrivals','[]')) x;
   -- Time labels are presentation strings only; all financial/attendance totals are server-derived.
   snapshot:=jsonb_build_object('date',p_list_date,'includedExpected',expected_count,'includedArrived',arrived,'includedMissing',greatest(expected_count-arrived,0),'hotelAdditional',hotel_extra,'opera',opera,'external',external_count,'additional',hotel_extra+opera+external_count,'total',arrived+hotel_extra+opera+external_count,'first',(SELECT min((e->>'at')::bigint) FROM jsonb_array_elements(bf41_security.effective_arrivals(data->'v8Arrivals')) e),'last',(SELECT max((e->>'at')::bigint) FROM jsonb_array_elements(bf41_security.effective_arrivals(data->'v8Arrivals')) e),'peak',left(coalesce(p_data->>'peak','–'),24),'eighty',left(coalesce(p_data->>'eighty','–'),24));
   data:=jsonb_set(data,'{v8History}',(SELECT coalesce(jsonb_agg(h),'[]') FROM jsonb_array_elements(coalesce(data->'v8History','[]')) h WHERE h->>'date'<>p_list_date::text)||jsonb_build_array(snapshot));
  END IF;
 END IF;
 data:=data||jsonb_build_object('updated',now_ms,'bf41Actions',coalesce(data->'bf41Actions','{}')||jsonb_build_object(p_action_id::text,jsonb_build_object('kind',p_kind,'user',bf41_security.uid())));
 UPDATE bf41_data.breakfast_lists SET payload=data,updated_at=now_ms WHERE list_date=p_list_date;
 INSERT INTO bf41_security.audit(user_id,session_id,app_role,operation,action_id,list_date,status) VALUES(bf41_security.uid(),(bf41_security.jwt()->>'session_id')::uuid,r,p_kind,p_action_id,p_list_date,'saved');
 RETURN jsonb_build_object('status','saved','payload',bf41_security.project_payload(data,r));
END $$;
RESET ROLE;
REVOKE CREATE ON SCHEMA bf41_security FROM bf41_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
