-- STAGING ONLY. A protected daily database job enforces configured retention.
create extension if not exists pg_cron with schema extensions;

create function guest_memory_private.purge_all_expired()
returns void language plpgsql security definer set search_path = '' as $$
declare h record;
begin
  for h in select id from public.gm_hotels loop
    perform guest_memory_private.purge_expired(h.id);
  end loop;
end $$;
revoke all on function guest_memory_private.purge_all_expired() from public, anon, authenticated;

select cron.schedule('ambassador-gm-staging-retention','15 3 * * *',
  'select guest_memory_private.purge_all_expired()');
