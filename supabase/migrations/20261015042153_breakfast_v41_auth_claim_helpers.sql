BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Supabase does not grant custom roles USAGE on its managed auth schema.
-- Read only the verified PostgREST request claims; live session validation still
-- runs through the private postgres-owned boolean helper. No Auth ACL changes.
CREATE FUNCTION bf41_security.jwt() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
CREATE FUNCTION bf41_security.uid() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$SELECT (bf41_security.jwt()->>'sub')::uuid$$;
REVOKE ALL ON FUNCTION bf41_security.jwt(),bf41_security.uid() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bf41_security.jwt(),bf41_security.uid() TO bf41_executor;
GRANT CREATE ON SCHEMA bf41_security TO bf41_executor;
SET LOCAL ROLE bf41_executor;
CREATE OR REPLACE FUNCTION bf41_security.actor_role() RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $body$
 SELECT m.app_role FROM bf41_security.members m
 JOIN bf41_security.approved_sessions d ON d.user_id=m.user_id
 WHERE m.user_id=bf41_security.uid() AND m.enabled
 AND d.session_id::text=bf41_security.jwt()->>'session_id' AND d.revoked_at IS NULL
 AND d.expires_at>statement_timestamp() AND bf41_security.valid_auth_session()
 AND (m.app_role<>'admin' OR bf41_security.jwt()->>'aal'='aal2')
$body$;
CREATE OR REPLACE FUNCTION bf41_security.project_payload(p_payload jsonb,p_role text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $body$
 SELECT CASE WHEN p_payload IS NULL THEN NULL WHEN p_role='admin' THEN p_payload-'v4ServiceActions'-'v42RoomEdits'-'bf41Actions' ELSE
 jsonb_build_object('date',p_payload->'date',
  'rooms',(SELECT coalesce(jsonb_agg((SELECT jsonb_object_agg(k,v) FROM jsonb_each(room) AS x(k,v)
   WHERE k IN ('room','people','guests','included','arrivedCount','departedCount','present','departed','table','serviceBookings','serviceLegacyTable','arrival','departure','note')) ORDER BY ord),'[]')
   FROM jsonb_array_elements(coalesce(p_payload->'rooms','[]')) WITH ORDINALITY AS r(room,ord)),
  'updated',p_payload->'updated',
  'v8Arrivals',(SELECT coalesce(jsonb_agg(e ORDER BY ord),'[]') FROM jsonb_array_elements(coalesce(p_payload->'v8Arrivals','[]')) WITH ORDINALITY a(e,ord)
   WHERE CASE WHEN e->>'at' ~ '^[0-9]{1,15}$' THEN (to_timestamp((e->>'at')::double precision/1000) AT TIME ZONE 'Europe/Zurich')::date::text=p_payload->>'date' ELSE false END),
  'v8Activity',(SELECT coalesce(jsonb_agg(e ORDER BY ord),'[]') FROM jsonb_array_elements(coalesce(p_payload->'v8Activity','[]')) WITH ORDINALITY a(e,ord)
   WHERE CASE WHEN e->>'at' ~ '^[0-9]{1,15}$' THEN (to_timestamp((e->>'at')::double precision/1000) AT TIME ZONE 'Europe/Zurich')::date::text=p_payload->>'date' ELSE false END),
  'v8History',(SELECT coalesce(jsonb_agg((SELECT jsonb_object_agg(k,v) FROM jsonb_each(h) x(k,v) WHERE k IN ('date','includedExpected','includedArrived','includedMissing','hotelAdditional','opera','external','additional','total','first','last','peak','eighty'))),'[]') FROM jsonb_array_elements(coalesce(p_payload->'v8History','[]')) h WHERE h->>'date'=p_payload->>'date' OR p_role='reception')) END
$body$;
CREATE OR REPLACE FUNCTION bf41_security.service_action(p_list_date date,p_room integer,p_expected jsonb,p_delta integer,p_action_id uuid,p_table text,p_undo_action_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE r text; result jsonb;
BEGIN
 r:=bf41_security.authorize('service',p_list_date);
 result:=bf41_data.breakfast_service_action_v41(p_list_date,p_room,p_expected,p_delta,p_action_id,p_table,p_undo_action_id);
 INSERT INTO bf41_security.audit(user_id,session_id,app_role,operation,action_id,list_date,status)
 VALUES(bf41_security.uid(),(bf41_security.jwt()->>'session_id')::uuid,r,'service',p_action_id,p_list_date,result->>'status');
 IF result ? 'payload' THEN result:=jsonb_set(result,'{payload}',bf41_security.project_payload(result->'payload',r)); END IF;
 RETURN result;
END $body$;
CREATE OR REPLACE FUNCTION bf41_security.edit_room(p_list_date date,p_room integer,p_expected jsonb,p_changes jsonb,p_action_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE r text; result jsonb;
BEGIN
 r:=bf41_security.authorize('edit',p_list_date);
 result:=bf41_data.breakfast_room_edit_v42(p_list_date,p_room,p_expected,p_changes,p_action_id);
 INSERT INTO bf41_security.audit(user_id,session_id,app_role,operation,action_id,list_date,status)
 VALUES(bf41_security.uid(),(bf41_security.jwt()->>'session_id')::uuid,r,'edit',p_action_id,p_list_date,result->>'status');
 IF result ? 'payload' THEN result:=jsonb_set(result,'{payload}',bf41_security.project_payload(result->'payload',r)); END IF;
 RETURN result;
END $body$;
CREATE OR REPLACE FUNCTION bf41_security.import_day(p_list_date date,p_rooms jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE r text; result jsonb;
BEGIN
 r:=bf41_security.authorize('import',p_list_date);
 SELECT jsonb_agg((SELECT jsonb_object_agg(k,v) FROM jsonb_each(room) x(k,v) WHERE k IN ('room','guests','people','included','arrival','departure','note'))) INTO p_rooms FROM jsonb_array_elements(p_rooms) room;
 IF octet_length(p_rooms::text)>131072 THEN RAISE EXCEPTION 'Import too large'; END IF;
 result:=bf41_data.breakfast_import_v41(p_list_date,p_rooms);
 INSERT INTO bf41_security.audit(user_id,session_id,app_role,operation,list_date,status)
 VALUES(bf41_security.uid(),(bf41_security.jwt()->>'session_id')::uuid,r,'import',p_list_date,result->>'status');
 IF result ? 'payload' THEN result:=jsonb_set(result,'{payload}',bf41_security.project_payload(result->'payload',r)); END IF;
 RETURN result;
END $body$;
CREATE OR REPLACE FUNCTION bf41_security.context(p_label text DEFAULT 'Browser') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m bf41_security.members; d bf41_security.approved_sessions; sid uuid;
BEGIN
 IF NOT bf41_security.valid_auth_session() THEN RAISE EXCEPTION 'Session invalid' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM bf41_security.members WHERE user_id=bf41_security.uid() AND enabled;
 IF m.user_id IS NULL THEN RETURN jsonb_build_object('status','not_authorized'); END IF;
 sid:=(bf41_security.jwt()->>'session_id')::uuid;
 INSERT INTO bf41_security.approved_sessions(session_id,user_id,label) VALUES(sid,bf41_security.uid(),left(coalesce(p_label,'Browser'),80)) ON CONFLICT DO NOTHING;
 SELECT * INTO d FROM bf41_security.approved_sessions WHERE session_id=sid AND user_id=bf41_security.uid();
 RETURN jsonb_build_object('status',CASE WHEN m.app_role='admin' AND bf41_security.jwt()->>'aal' IS DISTINCT FROM 'aal2' THEN 'mfa_required'
  WHEN d.revoked_at IS NOT NULL THEN 'revoked' WHEN d.expires_at<=statement_timestamp() THEN 'approval_required' ELSE 'ready' END,
  'role',m.app_role,'user_id',m.user_id,'display_name',m.display_name,'session_id',sid,'expires_at',d.expires_at,
  'mode',(SELECT mode FROM bf41_security.rollout_state WHERE singleton));
END $$;
CREATE OR REPLACE FUNCTION bf41_security.revoke_own() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT bf41_security.valid_auth_session() THEN RAISE EXCEPTION 'Session invalid' USING ERRCODE='42501'; END IF;
 UPDATE bf41_security.approved_sessions SET revoked_at=clock_timestamp() WHERE user_id=bf41_security.uid() AND session_id::text=bf41_security.jwt()->>'session_id';
END $$;
CREATE OR REPLACE FUNCTION bf41_security.admin(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text; uid uuid; sid uuid; hours integer;
BEGIN
 r:=bf41_security.authorize('admin',(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date);
 PERFORM pg_advisory_xact_lock(hashtext('bf41-members-admin'));
 IF p_action='list' THEN
  RETURN jsonb_build_object('members',(SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]') FROM bf41_security.members m),
  'sessions',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY requested_at DESC),'[]') FROM bf41_security.approved_sessions s));
 ELSIF p_action='approve_session' THEN
  sid:=(p_data->>'session_id')::uuid; hours:=coalesce((p_data->>'hours')::integer,720);
  IF hours<1 OR hours>720 THEN RAISE EXCEPTION 'Approval duration must be 1..720 hours'; END IF;
  SELECT user_id INTO uid FROM bf41_security.approved_sessions WHERE session_id=sid;
  IF NOT EXISTS(SELECT 1 FROM bf41_security.members WHERE user_id=uid AND enabled) THEN RAISE EXCEPTION 'Member missing'; END IF;
  IF EXISTS(SELECT 1 FROM bf41_security.members WHERE user_id=uid AND app_role='admin') THEN hours:=least(hours,12); END IF;
  UPDATE bf41_security.approved_sessions SET expires_at=clock_timestamp()+make_interval(hours=>hours),revoked_at=NULL,approved_by=bf41_security.uid() WHERE session_id=sid;
 ELSIF p_action='revoke_session' THEN
  UPDATE bf41_security.approved_sessions SET revoked_at=clock_timestamp() WHERE session_id=(p_data->>'session_id')::uuid;
 ELSIF p_action='member' THEN
  uid:=(p_data->>'user_id')::uuid;
  IF uid IS NULL OR p_data->>'role' NOT IN ('service','reception','admin') OR jsonb_typeof(p_data->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid member'; END IF;
  IF EXISTS(SELECT 1 FROM bf41_security.members WHERE user_id=uid AND enabled AND app_role='admin')
   AND ((p_data->>'enabled')::boolean=false OR p_data->>'role'<>'admin')
   AND (SELECT count(*) FROM bf41_security.members WHERE enabled AND app_role='admin')<2 THEN RAISE EXCEPTION 'Last administrator is protected'; END IF;
  INSERT INTO bf41_security.members(user_id,app_role,enabled,display_name) VALUES(uid,p_data->>'role',(p_data->>'enabled')::boolean,left(coalesce(p_data->>'display_name','Hotel team'),80))
   ON CONFLICT(user_id) DO UPDATE SET app_role=excluded.app_role,enabled=excluded.enabled,display_name=excluded.display_name;
  -- New rights always require device reapproval, including role elevation.
  UPDATE bf41_security.approved_sessions SET revoked_at=clock_timestamp() WHERE user_id=uid;
 ELSE RAISE EXCEPTION 'Unknown administration action'; END IF;
 INSERT INTO bf41_security.audit(user_id,session_id,app_role,operation,list_date,status)
 VALUES(bf41_security.uid(),(bf41_security.jwt()->>'session_id')::uuid,r,'admin:'||p_action,(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date,'saved');
 RETURN jsonb_build_object('status','saved');
END $$;
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
   snapshot:=jsonb_build_object('date',p_list_date,'includedExpected',expected_count,'includedArrived',arrived,'includedMissing',greatest(expected_count-arrived,0),'hotelAdditional',hotel_extra,'opera',opera,'external',external_count,'additional',hotel_extra+opera+external_count,'total',arrived+hotel_extra+opera+external_count,'peak',left(coalesce(p_data->>'peak','–'),24),'eighty',left(coalesce(p_data->>'eighty','–'),24));
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
