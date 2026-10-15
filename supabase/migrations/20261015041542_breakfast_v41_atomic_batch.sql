BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION bf41_security.batch(p_list_date date,p_operations jsonb,p_action_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text; op jsonb; result jsonb; data jsonb; child_id uuid; i integer:=0;
BEGIN
 r:=bf41_security.authorize('service',p_list_date);
 IF p_action_id IS NULL OR jsonb_typeof(p_operations) IS DISTINCT FROM 'array' OR jsonb_array_length(p_operations)<1 OR jsonb_array_length(p_operations)>44 OR octet_length(p_operations::text)>131072 THEN RAISE EXCEPTION 'Invalid batch'; END IF;
 SELECT payload INTO data FROM bf41_data.breakfast_lists WHERE list_date=p_list_date FOR UPDATE;
 IF data IS NULL THEN RETURN jsonb_build_object('status','missing'); END IF;
 FOR op IN SELECT value FROM jsonb_array_elements(p_operations) LOOP
  i:=i+1;child_id:=md5(p_action_id::text||':'||i::text)::uuid;
  IF op->>'kind'='edit' THEN
   result:=bf41_security.edit_room(p_list_date,(op->>'room')::integer,op->'expected',op->'changes',child_id);
  ELSIF op->>'kind'='service' THEN
   result:=bf41_security.service_action(p_list_date,(op->>'room')::integer,op->'expected',(op->>'delta')::integer,child_id,op->>'table',(op->>'undo_id')::uuid);
  ELSIF op->>'kind'='depart' THEN
   result:=bf41_security.workflow(p_list_date,'depart',jsonb_build_object('rooms',op->'rooms'),child_id);
  ELSE RAISE EXCEPTION 'Invalid batch operation'; END IF;
  IF result->>'status' NOT IN ('saved','duplicate') THEN RAISE EXCEPTION 'Concurrent change: reload the current day before trying again' USING ERRCODE='40001'; END IF;
 END LOOP;
 RETURN result;
END $$;
CREATE FUNCTION public.bf41_batch(p_list_date date,p_operations jsonb,p_action_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT bf41_security.batch(p_list_date,p_operations,p_action_id)$$;
GRANT CREATE ON SCHEMA bf41_security TO bf41_executor;
ALTER FUNCTION bf41_security.batch(date,jsonb,uuid) OWNER TO bf41_executor;
REVOKE CREATE ON SCHEMA bf41_security FROM bf41_executor;
REVOKE ALL ON FUNCTION bf41_security.batch(date,jsonb,uuid),public.bf41_batch(date,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bf41_security.batch(date,jsonb,uuid),public.bf41_batch(date,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
