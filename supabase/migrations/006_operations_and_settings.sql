-- Permite ao líder atualizar as configurações da própria loja.
drop policy if exists stores_update_member on public.stores;
create policy stores_update_member on public.stores
for update using (id = public.my_store_id())
with check (id = public.my_store_id());

-- Centraliza a mudança de estado e registra o histórico no banco.
create or replace function public.update_queue_status(p_entry_id uuid, p_status text)
returns public.queue_entries
language plpgsql security invoker set search_path = public
as $$
declare v_entry public.queue_entries; v_previous text;
begin
  if p_status not in ('waiting', 'called', 'attending', 'completed', 'skipped', 'cancelled', 'absent') then
    raise exception 'INVALID_STATUS';
  end if;
  select * into v_entry from public.queue_entries where id = p_entry_id for update;
  if v_entry.id is null then raise exception 'QUEUE_ENTRY_NOT_FOUND'; end if;
  v_previous := v_entry.status;
  update public.queue_entries set
    status = p_status,
    called_at = case when p_status = 'called' then coalesce(called_at, now()) else called_at end,
    service_started_at = case when p_status = 'attending' then coalesce(service_started_at, now()) else service_started_at end,
    finished_at = case when p_status in ('completed', 'skipped', 'absent') then now() else finished_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    updated_at = now()
  where id = p_entry_id returning * into v_entry;
  insert into public.queue_history(store_id, queue_entry_id, motoboy_id, action, previous_status, new_status, created_by)
  values(v_entry.store_id, v_entry.id, v_entry.motoboy_id, 'status_change', v_previous, p_status, auth.uid());
  return v_entry;
end;
$$;

grant execute on function public.update_queue_status(uuid, text) to authenticated;
