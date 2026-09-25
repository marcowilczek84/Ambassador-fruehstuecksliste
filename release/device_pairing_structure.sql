-- PRODUCTION PLAN ONLY: never execute before separate release approval.
create table public.gm_device_codes (
 id uuid primary key default gen_random_uuid(),
 hotel_id uuid not null references public.gm_hotels(id),
 code_hash bytea not null unique,
 expires_at timestamptz not null,
 claimed_at timestamptz,
 claimed_user_id uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.gm_devices (
 user_id uuid primary key references auth.users(id) on delete cascade,
 hotel_id uuid not null references public.gm_hotels(id),
 code_id uuid not null unique references public.gm_device_codes(id),
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
create index gm_devices_active_hotel on public.gm_devices(hotel_id,user_id) where revoked_at is null;
create index gm_device_codes_expiry on public.gm_device_codes(expires_at) where claimed_at is null;
alter table public.gm_device_codes enable row level security;
alter table public.gm_devices enable row level security;
revoke all on public.gm_device_codes,public.gm_devices from public,anon,authenticated;

create or replace function guest_memory_private.device_hotel(p_hotel uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.gm_devices d where d.user_id=(select auth.uid())
 and d.hotel_id=p_hotel and d.revoked_at is null)
$$;
revoke all on function guest_memory_private.device_hotel(uuid) from public,anon;
grant execute on function guest_memory_private.device_hotel(uuid) to authenticated;

create or replace function guest_memory_private.has_device() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.gm_devices d where d.user_id=(select auth.uid())
 and d.revoked_at is null)
$$;
revoke all on function guest_memory_private.has_device() from public,anon;
grant execute on function guest_memory_private.has_device() to authenticated;

-- Existing guest-memory functions use role_for. Both work areas share this
-- authorized-device role; neither gains an identity/merge privilege.
create or replace function guest_memory_private.role_for(p_hotel uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when guest_memory_private.device_hotel(p_hotel) then 'SERVICE' end
$$;

-- Only the Edge Function's service credential can consume a code.
create function public.gm_claim_device_code(p_code text) returns table(code_id uuid,hotel_id uuid)
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('request.jwt.claim.role',true) <> 'service_role' then
   raise exception 'permission denied' using errcode='42501';
 end if;
 if p_code !~ '^[a-f0-9]{32}$' then return; end if;
 return query update public.gm_device_codes c set claimed_at=clock_timestamp()
 where c.code_hash=extensions.digest(p_code,'sha256')
   and c.claimed_at is null and c.expires_at>clock_timestamp()
 returning c.id,c.hotel_id;
end $$;
revoke all on function public.gm_claim_device_code(text) from public,anon,authenticated;
grant execute on function public.gm_claim_device_code(text) to service_role;

create function public.gm_bind_device(p_code_id uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_hotel uuid;
begin
 if current_setting('request.jwt.claim.role',true) <> 'service_role' then
   raise exception 'permission denied' using errcode='42501';
 end if;
 select hotel_id into v_hotel from public.gm_device_codes
 where id=p_code_id and claimed_at>clock_timestamp()-interval '90 seconds'
 and claimed_user_id is null for update;
 if v_hotel is null then raise exception 'invalid pairing claim' using errcode='42501'; end if;
 insert into public.gm_devices(user_id,hotel_id,code_id) values(p_user,v_hotel,p_code_id);
 update public.gm_device_codes set claimed_user_id=p_user where id=p_code_id;
end $$;
revoke all on function public.gm_bind_device(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gm_bind_device(uuid,uuid) to service_role;

create function public.gm_device_status() returns boolean
language sql stable security definer set search_path='' as $$
 select guest_memory_private.has_device()
$$;
revoke all on function public.gm_device_status() from public,anon;
grant execute on function public.gm_device_status() to authenticated;

