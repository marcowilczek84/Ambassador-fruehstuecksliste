-- Additive service-only RPC. Existing API/schema/data and policies are retained.
-- Row lock + expected room + idempotency prevent duplicate and stale check-ins.
CREATE OR REPLACE FUNCTION public.breakfast_service_action_v4(
 p_list_date date, p_room integer, p_expected jsonb, p_delta integer, p_action_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.breakfast_service_action_v4(date,integer,jsonb,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.breakfast_service_action_v4(date,integer,jsonb,integer,uuid) TO anon,authenticated,service_role;
