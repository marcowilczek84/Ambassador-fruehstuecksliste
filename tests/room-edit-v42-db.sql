-- Run after service-v41-db.sql, against pg_temp functions and v41_test_lists only.
DO $$
DECLARE d date:=(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Zurich')::date; before_data jsonb; r jsonb; stale jsonb; result jsonb;
 a uuid:='00000000-0000-4000-8000-000000000042';
BEGIN
 SELECT payload INTO before_data FROM v41_test_lists WHERE list_date=d;
 r:=before_data#>'{rooms,0}';stale:=r||'{"arrivedCount":0,"present":false,"table":"","serviceBookings":[]}';
 result:=pg_temp.breakfast_room_edit_v42(d,20,stale,'{"note":"New reception note"}',a);
 ASSERT result->>'status'='saved','stale attendance does not block master-data update';
 ASSERT result#>>'{payload,rooms,0,arrivedCount}'='1','concurrent check-in preserved';
 ASSERT result#>>'{payload,rooms,0,table}'='Tisch 8','table preserved';
 ASSERT result#>'{payload,rooms,0,serviceBookings}'=r->'serviceBookings','booking ids preserved';
 ASSERT result#>>'{payload,rooms,0,note}'='New reception note','note saved';
 ASSERT result#>'{payload,v8Arrivals}'=before_data->'v8Arrivals','events unchanged';
 ASSERT result#>'{payload,v8Activity}'=before_data->'v8Activity','activity unchanged';
 ASSERT result#>'{payload,v8History}'=before_data->'v8History','history unchanged';
 before_data:=result->'payload';
 result:=pg_temp.breakfast_room_edit_v42(d,20,stale,'{"note":"New reception note"}',a);
 ASSERT result->>'status'='duplicate','lost-response retry is idempotent';
 ASSERT result->'payload'=before_data,'duplicate does not write';
 result:=pg_temp.breakfast_room_edit_v42(d,20,stale,'{"note":"Conflicting edit"}','00000000-0000-4000-8000-000000000043');
 ASSERT result->>'status'='conflict','stale master data rejected';
 ASSERT result->'payload'=before_data,'conflict leaves data intact';
 r:=before_data#>'{rooms,0}';
 BEGIN
  PERFORM pg_temp.breakfast_room_edit_v42(d,20,r,'{"arrivedCount":0}','00000000-0000-4000-8000-000000000044');
  RAISE EXCEPTION 'attendance payload must be rejected';
 EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Only guest master data may be edited','attendance cannot be supplied'; END;
 result:=pg_temp.breakfast_room_edit_v42(d,20,r,'{"people":1}','00000000-0000-4000-8000-000000000045');
 ASSERT result->>'status'='conflict','people below name count rejected';
 ASSERT (SELECT payload FROM v41_test_lists WHERE list_date=d)=before_data,'invalid edits leave data intact';
END $$;
SELECT '15 reception concurrency and integrity assertions passed' AS result;
