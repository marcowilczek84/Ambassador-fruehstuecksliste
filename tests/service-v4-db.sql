DO $$
DECLARE d date:=(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date; r jsonb:='{"room":20,"people":2,"guests":["QA One","QA Two"],"included":true,"arrivedCount":0,"note":"Keep note"}'; result jsonb; a uuid:='00000000-0000-4000-8000-000000000001';
BEGIN
 INSERT INTO v4_test_lists VALUES(d,jsonb_build_object('date',d,'rooms',jsonb_build_array(r),'v8Arrivals','[]'::jsonb,'v8Activity','[]'::jsonb,'v8History','[]'::jsonb,'updated',1),1);
 result:=pg_temp.breakfast_service_action_v4(d,20,r,1,a);ASSERT result->>'status'='saved','first save';ASSERT result#>>'{payload,rooms,0,arrivedCount}'='1','partial';
 result:=pg_temp.breakfast_service_action_v4(d,20,r,1,a);ASSERT result->>'status'='duplicate','retry idempotent';ASSERT result#>>'{payload,rooms,0,arrivedCount}'='1','retry no duplicate count';
 result:=pg_temp.breakfast_service_action_v4(d,20,r,1,'00000000-0000-4000-8000-000000000002');ASSERT result->>'status'='conflict','stale device rejected';
 r:=r||'{"arrivedCount":1}'::jsonb;
 result:=pg_temp.breakfast_service_action_v4(d,20,r,1,'00000000-0000-4000-8000-000000000003');ASSERT result#>>'{payload,rooms,0,arrivedCount}'='2','full check-in';
 r:=r||'{"arrivedCount":2}'::jsonb;
 result:=pg_temp.breakfast_service_action_v4(d,20,r,1,'00000000-0000-4000-8000-000000000004');ASSERT result->>'status'='conflict','overcount blocked';
 result:=pg_temp.breakfast_service_action_v4(d,20,r,-1,'00000000-0000-4000-8000-000000000005');ASSERT result#>>'{payload,rooms,0,arrivedCount}'='1','correction';ASSERT result#>>'{payload,rooms,0,note}'='Keep note','note preserved';
 ASSERT (SELECT sum((value->>'people')::integer) FROM jsonb_array_elements(result#>'{payload,v8Arrivals}'))=1,'arrival accounting';
 r:=r||'{"arrivedCount":1,"guests":["Other Guest"]}'::jsonb;
 result:=pg_temp.breakfast_service_action_v4(d,20,r,1,'00000000-0000-4000-8000-000000000006');ASSERT result->>'status'='conflict','changed guest rejected';
END $$;
SELECT '10 database assertions passed; isolated temporary table only' AS result;
