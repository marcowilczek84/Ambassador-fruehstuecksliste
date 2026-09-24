create function guest_memory_private.can_read_stay(p_hotel uuid,p_stay uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select guest_memory_private.role_for(p_hotel)='RECEPTION' or
  (guest_memory_private.role_for(p_hotel)='SERVICE' and exists(
    select 1 from public.guest_stays s where s.id=p_stay and s.hotel_id=p_hotel
    and s.arrival_date<=(now() at time zone 'Europe/Zurich')::date
    and s.departure_date>=(now() at time zone 'Europe/Zurich')::date))
$$;
revoke all on function guest_memory_private.can_read_stay(uuid,uuid) from public,anon;
grant execute on function guest_memory_private.can_read_stay(uuid,uuid) to authenticated;

drop policy gm_stay_read on public.guest_stays;
create policy gm_stay_read on public.guest_stays for select to authenticated
 using(guest_memory_private.can_read_stay(hotel_id,id));
drop policy gm_room_read on public.guest_stay_rooms;
create policy gm_room_read on public.guest_stay_rooms for select to authenticated
 using(guest_memory_private.can_read_stay(hotel_id,stay_id));
drop policy gm_notes_read on public.guest_notes;
create policy gm_notes_read on public.guest_notes for select to authenticated
 using(deleted_at is null and
  ((note_type='STAY' and guest_memory_private.can_read_stay(hotel_id,stay_id))
   or (note_type='PERSISTENT' and guest_memory_private.can_see_profile(hotel_id,guest_profile_id))));
drop policy gm_notes_insert on public.guest_notes;
create policy gm_notes_insert on public.guest_notes for insert to authenticated
 with check(deleted_at is null and
  ((note_type='STAY' and guest_memory_private.can_read_stay(hotel_id,stay_id))
   or (note_type='PERSISTENT' and guest_memory_private.can_see_profile(hotel_id,guest_profile_id))));
drop policy gm_notes_update on public.guest_notes;
create policy gm_notes_update on public.guest_notes for update to authenticated
 using((note_type='STAY' and guest_memory_private.can_read_stay(hotel_id,stay_id))
   or (note_type='PERSISTENT' and guest_memory_private.can_see_profile(hotel_id,guest_profile_id)))
 with check(deleted_at is null and
  ((note_type='STAY' and guest_memory_private.can_read_stay(hotel_id,stay_id))
   or (note_type='PERSISTENT' and guest_memory_private.can_see_profile(hotel_id,guest_profile_id))));

create or replace function guest_memory_private.note_timestamp() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if old.created_at is distinct from new.created_at
      or old.hotel_id is distinct from new.hotel_id
      or old.note_type is distinct from new.note_type
      or old.stay_id is distinct from new.stay_id
      or (old.guest_profile_id is distinct from new.guest_profile_id
          and current_setting('guest_memory.profile_merge',true)<>'enabled')
      or (old.deleted_at is distinct from new.deleted_at
          and current_setting('guest_memory.note_delete',true)<>'enabled') then
     raise exception 'note identity/deletion cannot be changed directly';
   end if;
   new.created_at:=old.created_at;
   new.updated_at:=case when old.body is distinct from new.body
                            or old.deleted_at is distinct from new.deleted_at
                        then clock_timestamp() else old.updated_at end;
 end if;
 return new;
end $$;

create or replace function public.gm_soft_delete_note(p_note uuid) returns void
language plpgsql security definer set search_path='' as $$
declare n public.guest_notes%rowtype; r text;
begin
 select * into n from public.guest_notes where id=p_note for update;
 if not found then raise exception 'unknown note'; end if;
 r:=guest_memory_private.require_role(n.hotel_id,n.note_type='PERSISTENT');
 if r='SERVICE' and n.note_type='STAY' and not guest_memory_private.can_read_stay(n.hotel_id,n.stay_id) then
   raise exception 'only current stay notes are editable';
 end if;
 perform pg_catalog.set_config('guest_memory.note_delete','enabled',true);
 update public.guest_notes set deleted_at=clock_timestamp() where id=n.id and deleted_at is null;
end $$;

create or replace function public.gm_create_profile_for_stay(p_stay uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.guest_stays%rowtype; profile uuid; r text;
begin
 select * into s from public.guest_stays where id=p_stay for update;
 if not found then raise exception 'unknown stay'; end if;
 r:=guest_memory_private.require_role(s.hotel_id,false);
 if r='SERVICE' and not guest_memory_private.can_read_stay(s.hotel_id,s.id) then
   raise exception 'service cannot create a profile for an old stay';
 end if;
 if s.guest_profile_id is not null then return s.guest_profile_id; end if;
 insert into public.guest_profiles(hotel_id,display_name,normalized_name)
 values(s.hotel_id,s.original_name,s.normalized_name) returning id into profile;
 update public.guest_stays set guest_profile_id=profile,match_state='CONFIRMED',updated_at=now()
 where id=s.id;
 return profile;
end $$;

create function public.gm_correct_stay_dates(p_stay uuid,p_arrival date,p_departure date)
returns void language plpgsql security definer set search_path='' as $$
declare s public.guest_stays%rowtype;
begin
 select * into s from public.guest_stays where id=p_stay for update;
 if s.id is null or p_arrival is null or p_departure<p_arrival then
   raise exception 'invalid date correction';
 end if;
 perform guest_memory_private.require_role(s.hotel_id,true);
 update public.guest_stays set arrival_date=p_arrival,departure_date=p_departure,
   match_state=case when guest_profile_id is null then 'UNLINKED' else 'CONFIRMED' end,
   updated_at=now() where id=s.id;
end $$;
revoke all on function public.gm_correct_stay_dates(uuid,date,date) from public,anon;
grant execute on function public.gm_correct_stay_dates(uuid,date,date) to authenticated;
