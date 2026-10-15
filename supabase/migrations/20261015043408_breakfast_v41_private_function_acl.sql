BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Supabase postgres is not a superuser and membership uses INHERIT FALSE.
-- Revoke as the actual function owner; never rely on a silently ignored GRANT.
SET LOCAL ROLE bf41_executor;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='bf41_security' AND pg_get_userbyid(p.proowner)=current_user LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION bf41_security.read_day(date),bf41_security.service_action(date,integer,jsonb,integer,uuid,text,uuid),bf41_security.edit_room(date,integer,jsonb,jsonb,uuid),bf41_security.import_day(date,jsonb),bf41_security.context(text),bf41_security.revoke_own(),bf41_security.admin(text,jsonb),bf41_security.workflow(date,text,jsonb,uuid),bf41_security.batch(date,jsonb,uuid) TO authenticated;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('bf41_security','bf41_data') AND has_function_privilege('anon',p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'Anonymous execute privileges remain'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('bf41_security','bf41_data') AND c.relkind='r' AND (NOT c.relrowsecurity OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'))) THEN RAISE EXCEPTION 'Unsafe table privileges'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
