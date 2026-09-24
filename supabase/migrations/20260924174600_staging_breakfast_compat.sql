-- Staging-only empty compatibility table. Never populate it with hotel production data.
create table public.breakfast_lists (
 list_date date primary key,
 payload jsonb not null default '{}'::jsonb,
 updated_at bigint not null default 0
);
alter table public.breakfast_lists enable row level security;
grant select,insert,update,delete on public.breakfast_lists to anon,authenticated;
create policy staging_breakfast_read on public.breakfast_lists for select to anon,authenticated using(true);
create policy staging_breakfast_insert on public.breakfast_lists for insert to anon,authenticated with check(true);
create policy staging_breakfast_update on public.breakfast_lists for update to anon,authenticated using(true) with check(true);
create policy staging_breakfast_delete on public.breakfast_lists for delete to anon,authenticated using(true);

create function public.merge_breakfast_changes(
 p_list_date date,p_rooms jsonb default '[]'::jsonb,p_arrivals jsonb default '[]'::jsonb,
 p_history jsonb default null,p_activity jsonb default '[]'::jsonb,p_updated bigint default 0
) returns jsonb language plpgsql security invoker set search_path='public' as $$
declare old_payload jsonb; merged jsonb;
begin
 if jsonb_typeof(p_rooms)<>'array' or jsonb_typeof(p_arrivals)<>'array'
    or jsonb_typeof(p_activity)<>'array' then raise exception 'expected arrays'; end if;
 insert into public.breakfast_lists(list_date,payload,updated_at)
 values(p_list_date,jsonb_build_object('rooms','[]'::jsonb,'v8Arrivals','[]'::jsonb,
   'v8Activity','[]'::jsonb,'v8History','[]'::jsonb),0)
 on conflict do nothing;
 select payload into old_payload from public.breakfast_lists where list_date=p_list_date for update;
 select coalesce(jsonb_agg(item order by (item->>'room')::int),'[]'::jsonb) into merged from (
   select old.item from jsonb_array_elements(coalesce(old_payload->'rooms','[]'::jsonb)) old(item)
   where not exists(select 1 from jsonb_array_elements(p_rooms) changed(item)
                    where changed.item->>'room'=old.item->>'room')
   union all select item from jsonb_array_elements(p_rooms) changed(item)
 ) x;
 old_payload := old_payload || jsonb_build_object('date',p_list_date::text,'rooms',merged,
   'v8Arrivals',coalesce(old_payload->'v8Arrivals','[]'::jsonb) || p_arrivals,
   'v8Activity',p_activity,
   'v8History',coalesce(p_history,old_payload->'v8History','[]'::jsonb),
   'updated',greatest(p_updated,coalesce((old_payload->>'updated')::bigint,0)));
 update public.breakfast_lists set payload=old_payload,updated_at=greatest(p_updated,updated_at)
 where list_date=p_list_date;
 return old_payload;
end $$;
revoke all on function public.merge_breakfast_changes(date,jsonb,jsonb,jsonb,jsonb,bigint) from public;
grant execute on function public.merge_breakfast_changes(date,jsonb,jsonb,jsonb,jsonb,bigint) to anon,authenticated;
