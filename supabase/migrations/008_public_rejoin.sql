create or replace function public.rejoin_public_queue(p_entry_id uuid, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_old public.queue_entries; v_new public.queue_entries; v_position integer;
begin
  select * into v_old from public.queue_entries where id = p_entry_id for update;
  if v_old.id is null then raise exception 'QUEUE_ENTRY_NOT_FOUND'; end if;
  if not exists (select 1 from public.store_access_codes where store_id = v_old.store_id and code = p_code and expires_at >= now()) then
    raise exception 'ACCESS_CODE_EXPIRED';
  end if;
  update public.queue_entries set status = 'completed', finished_at = now(), updated_at = now() where id = v_old.id;
  insert into public.queue_history(store_id, queue_entry_id, motoboy_id, action, previous_status, new_status)
  values(v_old.store_id, v_old.id, v_old.motoboy_id, 'public_rejoin', v_old.status, 'completed');
  select coalesce(max(position), 0) + 1 into v_position from public.queue_entries where store_id = v_old.store_id and status in ('waiting', 'called', 'attending');
  insert into public.queue_entries(store_id, motoboy_id, position, status)
  values(v_old.store_id, v_old.motoboy_id, v_position, 'waiting') returning * into v_new;
  insert into public.queue_history(store_id, queue_entry_id, motoboy_id, action, new_status)
  values(v_new.store_id, v_new.id, v_new.motoboy_id, 'public_rejoin', 'waiting');
  return json_build_object('entry_id', v_new.id, 'position', v_position);
end;
$$;

grant execute on function public.rejoin_public_queue(uuid, text) to anon, authenticated;
