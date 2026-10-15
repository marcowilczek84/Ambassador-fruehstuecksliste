-- V4.1 ISOLATED STAGING ONLY. Does not modify any existing table or global Auth configuration.
-- Requires only synthetic data and a minimal isolated auth fixture.
-- The explicit marker prevents accidental execution; it is not a security boundary.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN
 IF to_regprocedure('bf41_data.breakfast_service_action_v41(date,integer,jsonb,integer,uuid,text,uuid)') IS NOT NULL THEN
  RAISE EXCEPTION 'Isolated V4.1 migration: existing breakfast application detected. Production forbidden';
 END IF;
END $guard$;
CREATE SCHEMA bf41_data;
REVOKE ALL ON SCHEMA bf41_data FROM PUBLIC,anon,authenticated;
CREATE TABLE bf41_data.breakfast_lists(list_date date PRIMARY KEY,payload jsonb NOT NULL DEFAULT '{}',updated_at bigint NOT NULL DEFAULT 0);
ALTER TABLE bf41_data.breakfast_lists ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bf41_data.breakfast_lists FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION bf41_data.breakfast_import_v41(p_list_date date, p_rooms jsonb)
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
 INSERT INTO bf41_data.breakfast_lists(list_date,payload,updated_at) VALUES(p_list_date,jsonb_build_object('date',p_list_date,'rooms','[]'::jsonb,'v8Arrivals','[]'::jsonb,'v8Activity','[]'::jsonb,'v8History','[]'::jsonb,'updated',0),0) ON CONFLICT(list_date) DO NOTHING;
 SELECT payload INTO data FROM bf41_data.breakfast_lists WHERE list_date=p_list_date FOR UPDATE;
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
 UPDATE bf41_data.breakfast_lists SET payload=data,updated_at=now_ms WHERE list_date=p_list_date;
 RETURN jsonb_build_object('status','saved','payload',data);
END $function$;
CREATE OR REPLACE FUNCTION bf41_data.breakfast_room_edit_v42(p_list_date date, p_room integer, p_expected jsonb, p_changes jsonb, p_action_id uuid)
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
 SELECT payload INTO data FROM bf41_data.breakfast_lists WHERE list_date=p_list_date FOR UPDATE;
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
 UPDATE bf41_data.breakfast_lists SET payload=data,updated_at=now_ms WHERE list_date=p_list_date;
 RETURN jsonb_build_object('status','saved','payload',data);
END $function$;
CREATE OR REPLACE FUNCTION bf41_data.breakfast_service_action_v41(p_list_date date, p_room integer, p_expected jsonb, p_delta integer, p_action_id uuid, p_table text DEFAULT NULL::text, p_undo_action_id uuid DEFAULT NULL::uuid)
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
 IF p_delta>0 AND (p_table IS NULL OR p_table !~ '^(Tisch ([1-9]|[1-4][0-9]|50)|Roomservice)$') THEN RAISE EXCEPTION 'Choose a valid table or Roomservice'; END IF;
 SELECT payload INTO data FROM bf41_data.breakfast_lists WHERE list_date=p_list_date FOR UPDATE;
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
 UPDATE bf41_data.breakfast_lists SET payload=data,updated_at=now_ms WHERE list_date=p_list_date;
 RETURN jsonb_build_object('status','saved','payload',data);
END $function$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bf41_data FROM PUBLIC,anon,authenticated;
CREATE ROLE bf41_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT bf41_executor TO postgres WITH INHERIT FALSE, SET TRUE;
CREATE SCHEMA bf41_security;
REVOKE ALL ON SCHEMA bf41_security FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public,auth,bf41_security,bf41_data TO bf41_executor;
-- USAGE permits calling the narrow functions, NOT reading private tables.
-- bf41_security must NEVER be configured as an exposed PostgREST schema.
GRANT USAGE ON SCHEMA bf41_security TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO bf41_executor;

CREATE TABLE bf41_security.members(
 user_id uuid PRIMARY KEY,
 display_name text NOT NULL DEFAULT 'Hotel team',
 app_role text NOT NULL CHECK(app_role IN ('service','reception','admin')),
 enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE bf41_security.approved_sessions(
 session_id uuid PRIMARY KEY,user_id uuid NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 requested_at timestamptz NOT NULL DEFAULT now(),label text NOT NULL DEFAULT 'Browser',approved_by uuid
);
CREATE TABLE bf41_security.rollout_state(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 mode text NOT NULL CHECK(mode IN ('shadow','enforced','paused'))
);
INSERT INTO bf41_security.rollout_state VALUES(true,'enforced');
CREATE TABLE bf41_security.audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 user_id uuid NOT NULL,session_id uuid NOT NULL,app_role text NOT NULL,
 operation text NOT NULL,action_id uuid,list_date date NOT NULL,status text NOT NULL
);
REVOKE ALL ON ALL TABLES IN SCHEMA bf41_security FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA bf41_security FROM PUBLIC,anon,authenticated;
ALTER TABLE bf41_security.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bf41_security.approved_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bf41_security.rollout_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE bf41_security.audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY executor_members ON bf41_security.members FOR SELECT TO bf41_executor USING(true);
CREATE POLICY executor_sessions ON bf41_security.approved_sessions FOR SELECT TO bf41_executor USING(true);
CREATE POLICY executor_rollout ON bf41_security.rollout_state FOR SELECT TO bf41_executor USING(true);
CREATE POLICY executor_audit ON bf41_security.audit FOR INSERT TO bf41_executor WITH CHECK(true);
GRANT SELECT ON bf41_security.members,bf41_security.approved_sessions,bf41_security.rollout_state TO bf41_executor;
GRANT INSERT ON bf41_security.audit TO bf41_executor;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA bf41_security TO bf41_executor;

-- The live auth tables have RLS with no policies. Ordinary column grants alone
-- cannot validate a session. This zero-argument, boolean-only private lookup
-- deliberately uses the migration owner's access; it exposes no auth rows,
-- checks auth.uid(), and is callable ONLY by the narrow executor role.
-- No policies, ownership or grants on shared auth tables are changed.
CREATE FUNCTION bf41_security.valid_auth_session() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT auth.uid() IS NOT NULL
 AND auth.jwt()->>'role'='authenticated'
 AND coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 AND (auth.jwt()->>'exp')::numeric>extract(epoch FROM statement_timestamp())
 AND EXISTS(SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id
  WHERE u.id=auth.uid() AND NOT u.is_anonymous
  AND s.id::text=auth.jwt()->>'session_id'
  AND (s.not_after IS NULL OR s.not_after>statement_timestamp()))
$body$;
REVOKE ALL ON FUNCTION bf41_security.valid_auth_session() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bf41_security.valid_auth_session() TO bf41_executor;

CREATE FUNCTION bf41_security.actor_role() RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $body$
 SELECT m.app_role FROM bf41_security.members m
 JOIN bf41_security.approved_sessions d ON d.user_id=m.user_id
 WHERE m.user_id=auth.uid() AND m.enabled
 AND d.session_id::text=auth.jwt()->>'session_id' AND d.revoked_at IS NULL
 AND d.expires_at>statement_timestamp() AND bf41_security.valid_auth_session()
 AND (m.app_role<>'admin' OR auth.jwt()->>'aal'='aal2')
$body$;

CREATE FUNCTION bf41_security.authorize(p_operation text,p_date date) RETURNS text
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $body$
DECLARE r text:=bf41_security.actor_role();
BEGIN
 IF r IS NULL THEN RAISE EXCEPTION 'Breakfast access denied' USING ERRCODE='42501'; END IF;
 IF p_operation NOT IN ('read','service','edit','import','special','depart','close','reopen','clear','admin') THEN RAISE EXCEPTION 'Unknown operation' USING ERRCODE='42501'; END IF;
 IF p_date IS NULL OR (p_date<>(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date AND (r<>'admin' OR p_operation<>'read')) THEN
  RAISE EXCEPTION 'Date access denied' USING ERRCODE='42501';
 END IF;
 IF p_operation IN ('edit','import','close','reopen','clear') AND r NOT IN ('reception','admin') THEN
  RAISE EXCEPTION 'Reception permission required' USING ERRCODE='42501';
 END IF;
 IF p_operation='admin' AND r<>'admin' THEN RAISE EXCEPTION 'Administration permission required' USING ERRCODE='42501'; END IF;
 IF p_operation<>'read' AND NOT coalesce((SELECT mode IN ('shadow','enforced') FROM bf41_security.rollout_state WHERE singleton),false) THEN
  RAISE EXCEPTION 'Breakfast writes paused' USING ERRCODE='42501';
 END IF;
 RETURN r;
END $body$;

-- Retain only current-day closure state for service/reception; never return
-- the internal idempotency ledger or embedded older history via any RPC result.
-- This projection is a prototype and requires full UI/statistics acceptance.
CREATE FUNCTION bf41_security.project_payload(p_payload jsonb,p_role text) RETURNS jsonb
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
  'v8History',(SELECT coalesce(jsonb_agg(h),'[]') FROM jsonb_array_elements(coalesce(p_payload->'v8History','[]')) h WHERE h->>'date'=p_payload->>'date')) END
$body$;

CREATE FUNCTION bf41_security.read_day(p_list_date date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE r text; result jsonb;
BEGIN
 r:=bf41_security.authorize('read',p_list_date);
 SELECT bf41_security.project_payload(payload,r) INTO result FROM bf41_data.breakfast_lists WHERE list_date=p_list_date;
 RETURN jsonb_build_object('status',CASE WHEN result IS NULL THEN 'missing' ELSE 'ok' END,'payload',result,'role',r);
END $body$;

CREATE FUNCTION bf41_security.service_action(p_list_date date,p_room integer,p_expected jsonb,p_delta integer,p_action_id uuid,p_table text,p_undo_action_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE r text; result jsonb;
BEGIN
 r:=bf41_security.authorize('service',p_list_date);
 result:=bf41_data.breakfast_service_action_v41(p_list_date,p_room,p_expected,p_delta,p_action_id,p_table,p_undo_action_id);
 INSERT INTO bf41_security.audit(user_id,session_id,app_role,operation,action_id,list_date,status)
 VALUES(auth.uid(),(auth.jwt()->>'session_id')::uuid,r,'service',p_action_id,p_list_date,result->>'status');
 IF result ? 'payload' THEN result:=jsonb_set(result,'{payload}',bf41_security.project_payload(result->'payload',r)); END IF;
 RETURN result;
END $body$;

CREATE FUNCTION bf41_security.edit_room(p_list_date date,p_room integer,p_expected jsonb,p_changes jsonb,p_action_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE r text; result jsonb;
BEGIN
 r:=bf41_security.authorize('edit',p_list_date);
 result:=bf41_data.breakfast_room_edit_v42(p_list_date,p_room,p_expected,p_changes,p_action_id);
 INSERT INTO bf41_security.audit(user_id,session_id,app_role,operation,action_id,list_date,status)
 VALUES(auth.uid(),(auth.jwt()->>'session_id')::uuid,r,'edit',p_action_id,p_list_date,result->>'status');
 IF result ? 'payload' THEN result:=jsonb_set(result,'{payload}',bf41_security.project_payload(result->'payload',r)); END IF;
 RETURN result;
END $body$;

CREATE FUNCTION bf41_security.import_day(p_list_date date,p_rooms jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE r text; result jsonb;
BEGIN
 r:=bf41_security.authorize('import',p_list_date);
 SELECT jsonb_agg((SELECT jsonb_object_agg(k,v) FROM jsonb_each(room) x(k,v) WHERE k IN ('room','guests','people','included','arrival','departure','note'))) INTO p_rooms FROM jsonb_array_elements(p_rooms) room;
 IF octet_length(p_rooms::text)>131072 THEN RAISE EXCEPTION 'Import too large'; END IF;
 result:=bf41_data.breakfast_import_v41(p_list_date,p_rooms);
 INSERT INTO bf41_security.audit(user_id,session_id,app_role,operation,list_date,status)
 VALUES(auth.uid(),(auth.jwt()->>'session_id')::uuid,r,'import',p_list_date,result->>'status');
 IF result ? 'payload' THEN result:=jsonb_set(result,'{payload}',bf41_security.project_payload(result->'payload',r)); END IF;
 RETURN result;
END $body$;

GRANT CREATE ON SCHEMA bf41_security TO bf41_executor;
ALTER FUNCTION bf41_security.actor_role() OWNER TO bf41_executor;
ALTER FUNCTION bf41_security.authorize(text,date) OWNER TO bf41_executor;
ALTER FUNCTION bf41_security.project_payload(jsonb,text) OWNER TO bf41_executor;
ALTER FUNCTION bf41_security.read_day(date) OWNER TO bf41_executor;
ALTER FUNCTION bf41_security.service_action(date,integer,jsonb,integer,uuid,text,uuid) OWNER TO bf41_executor;
ALTER FUNCTION bf41_security.edit_room(date,integer,jsonb,jsonb,uuid) OWNER TO bf41_executor;
ALTER FUNCTION bf41_security.import_day(date,jsonb) OWNER TO bf41_executor;
REVOKE CREATE ON SCHEMA bf41_security FROM bf41_executor;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bf41_security FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bf41_security.read_day(date),bf41_security.service_action(date,integer,jsonb,integer,uuid,text,uuid),bf41_security.edit_room(date,integer,jsonb,jsonb,uuid),bf41_security.import_day(date,jsonb) TO authenticated;

-- Public API functions are invokers. Only their narrow private implementations
-- elevate to the dedicated NOLOGIN/NOBYPASSRLS role, never to postgres.
CREATE FUNCTION public.bf41_read(p_list_date date) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT bf41_security.read_day(p_list_date) $body$;
CREATE FUNCTION public.bf41_service(p_list_date date,p_room integer,p_expected jsonb,p_delta integer,p_action_id uuid,p_table text DEFAULT NULL,p_undo_action_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT bf41_security.service_action(p_list_date,p_room,p_expected,p_delta,p_action_id,p_table,p_undo_action_id) $body$;
CREATE FUNCTION public.bf41_edit(p_list_date date,p_room integer,p_expected jsonb,p_changes jsonb,p_action_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT bf41_security.edit_room(p_list_date,p_room,p_expected,p_changes,p_action_id) $body$;
CREATE FUNCTION public.bf41_import(p_list_date date,p_rooms jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT bf41_security.import_day(p_list_date,p_rooms) $body$;
REVOKE ALL ON FUNCTION public.bf41_read(date),public.bf41_service(date,integer,jsonb,integer,uuid,text,uuid),public.bf41_edit(date,integer,jsonb,jsonb,uuid),public.bf41_import(date,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bf41_read(date),public.bf41_service(date,integer,jsonb,integer,uuid,text,uuid),public.bf41_edit(date,integer,jsonb,jsonb,uuid),public.bf41_import(date,jsonb) TO authenticated;

GRANT SELECT,INSERT,UPDATE ON bf41_data.breakfast_lists TO bf41_executor;
GRANT EXECUTE ON FUNCTION bf41_data.breakfast_service_action_v41(date,integer,jsonb,integer,uuid,text,uuid),bf41_data.breakfast_room_edit_v42(date,integer,jsonb,jsonb,uuid),bf41_data.breakfast_import_v41(date,jsonb) TO bf41_executor;
CREATE POLICY breakfast_secure_read ON bf41_data.breakfast_lists FOR SELECT TO bf41_executor
 USING(bf41_security.actor_role()='admin' OR (bf41_security.actor_role() IN ('service','reception') AND list_date=(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date));
CREATE POLICY breakfast_secure_insert ON bf41_data.breakfast_lists FOR INSERT TO bf41_executor
 WITH CHECK(bf41_security.actor_role() IN ('reception','admin') AND list_date=(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date);
CREATE POLICY breakfast_secure_update ON bf41_data.breakfast_lists FOR UPDATE TO bf41_executor
 USING(bf41_security.actor_role() IN ('service','reception','admin') AND list_date=(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date)
 WITH CHECK(bf41_security.actor_role() IN ('service','reception','admin') AND list_date=(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date);
-- No DELETE policy or permission, no client membership in bf41_executor.


-- Private membership/session registry. Every operation checks live Auth session,
-- DB membership, device approval and (for administration) AAL2.
GRANT INSERT,UPDATE ON bf41_security.approved_sessions,bf41_security.members TO bf41_executor;
CREATE POLICY executor_sessions_insert ON bf41_security.approved_sessions FOR INSERT TO bf41_executor WITH CHECK(true);
CREATE POLICY executor_sessions_update ON bf41_security.approved_sessions FOR UPDATE TO bf41_executor USING(true) WITH CHECK(true);
CREATE POLICY executor_members_insert ON bf41_security.members FOR INSERT TO bf41_executor WITH CHECK(true);
CREATE POLICY executor_members_update ON bf41_security.members FOR UPDATE TO bf41_executor USING(true) WITH CHECK(true);

CREATE FUNCTION bf41_security.context(p_label text DEFAULT 'Browser') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m bf41_security.members; d bf41_security.approved_sessions; sid uuid;
BEGIN
 IF NOT bf41_security.valid_auth_session() THEN RAISE EXCEPTION 'Session invalid' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM bf41_security.members WHERE user_id=auth.uid() AND enabled;
 IF m.user_id IS NULL THEN RETURN jsonb_build_object('status','not_authorized'); END IF;
 sid:=(auth.jwt()->>'session_id')::uuid;
 INSERT INTO bf41_security.approved_sessions(session_id,user_id,label) VALUES(sid,auth.uid(),left(coalesce(p_label,'Browser'),80)) ON CONFLICT DO NOTHING;
 SELECT * INTO d FROM bf41_security.approved_sessions WHERE session_id=sid AND user_id=auth.uid();
 RETURN jsonb_build_object('status',CASE WHEN m.app_role='admin' AND auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' THEN 'mfa_required'
  WHEN d.revoked_at IS NOT NULL THEN 'revoked' WHEN d.expires_at<=statement_timestamp() THEN 'approval_required' ELSE 'ready' END,
  'role',m.app_role,'user_id',m.user_id,'display_name',m.display_name,'session_id',sid,'expires_at',d.expires_at,
  'mode',(SELECT mode FROM bf41_security.rollout_state WHERE singleton));
END $$;
CREATE FUNCTION bf41_security.revoke_own() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT bf41_security.valid_auth_session() THEN RAISE EXCEPTION 'Session invalid' USING ERRCODE='42501'; END IF;
 UPDATE bf41_security.approved_sessions SET revoked_at=clock_timestamp() WHERE user_id=auth.uid() AND session_id::text=auth.jwt()->>'session_id';
END $$;
CREATE FUNCTION bf41_security.admin(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb
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
  UPDATE bf41_security.approved_sessions SET expires_at=clock_timestamp()+make_interval(hours=>hours),revoked_at=NULL,approved_by=auth.uid() WHERE session_id=sid;
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
 VALUES(auth.uid(),(auth.jwt()->>'session_id')::uuid,r,'admin:'||p_action,(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date,'saved');
 RETURN jsonb_build_object('status','saved');
END $$;

CREATE FUNCTION public.bf41_context(p_label text DEFAULT 'Browser') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT bf41_security.context(p_label)$$;
CREATE FUNCTION public.bf41_revoke_own() RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT bf41_security.revoke_own()$$;
CREATE FUNCTION public.bf41_admin(p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT bf41_security.admin(p_action,p_data)$$;
GRANT CREATE ON SCHEMA bf41_security TO bf41_executor;
ALTER FUNCTION bf41_security.context(text) OWNER TO bf41_executor;
ALTER FUNCTION bf41_security.revoke_own() OWNER TO bf41_executor;
ALTER FUNCTION bf41_security.admin(text,jsonb) OWNER TO bf41_executor;
REVOKE CREATE ON SCHEMA bf41_security FROM bf41_executor;
REVOKE ALL ON FUNCTION bf41_security.context(text),bf41_security.revoke_own(),bf41_security.admin(text,jsonb),public.bf41_context(text),public.bf41_revoke_own(),public.bf41_admin(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bf41_security.context(text),bf41_security.revoke_own(),bf41_security.admin(text,jsonb),public.bf41_context(text),public.bf41_revoke_own(),public.bf41_admin(text,jsonb) TO authenticated;

-- Typed operations replace the legacy unrestricted JSON merge and DELETE.
CREATE FUNCTION bf41_security.workflow(p_list_date date,p_kind text,p_data jsonb,p_action_id uuid) RETURNS jsonb
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
 data:=data||jsonb_build_object('updated',now_ms,'bf41Actions',coalesce(data->'bf41Actions','{}')||jsonb_build_object(p_action_id::text,jsonb_build_object('kind',p_kind,'user',auth.uid())));
 UPDATE bf41_data.breakfast_lists SET payload=data,updated_at=now_ms WHERE list_date=p_list_date;
 INSERT INTO bf41_security.audit(user_id,session_id,app_role,operation,action_id,list_date,status) VALUES(auth.uid(),(auth.jwt()->>'session_id')::uuid,r,p_kind,p_action_id,p_list_date,'saved');
 RETURN jsonb_build_object('status','saved','payload',bf41_security.project_payload(data,r));
END $$;
CREATE FUNCTION public.bf41_workflow(p_list_date date,p_kind text,p_data jsonb,p_action_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT bf41_security.workflow(p_list_date,p_kind,p_data,p_action_id)$$;
GRANT CREATE ON SCHEMA bf41_security TO bf41_executor;
ALTER FUNCTION bf41_security.workflow(date,text,jsonb,uuid) OWNER TO bf41_executor;
REVOKE CREATE ON SCHEMA bf41_security FROM bf41_executor;
REVOKE ALL ON FUNCTION bf41_security.workflow(date,text,jsonb,uuid),public.bf41_workflow(date,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bf41_security.workflow(date,text,jsonb,uuid),public.bf41_workflow(date,text,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
