-- STAGING ONLY. Rejection preserves the source row for audit and idempotent backfill.
create function public.gm_discard_legacy(p_legacy uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare item public.guest_legacy_unresolved%rowtype;
begin
  select * into item from public.guest_legacy_unresolved where id=p_legacy for update;
  if item.id is null or item.assignment_status <> 'UNRESOLVED' then
    raise exception 'unresolved legacy note not found';
  end if;
  perform guest_memory_private.require_role(item.hotel_id,true);
  update public.guest_legacy_unresolved
  set assignment_status='DELETED',resolved_at=clock_timestamp()
  where id=item.id;
end $$;
revoke all on function public.gm_discard_legacy(uuid) from public, anon;
grant execute on function public.gm_discard_legacy(uuid) to authenticated;
