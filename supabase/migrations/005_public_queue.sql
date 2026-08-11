-- Leitura da fila pelo aplicativo público do motoboy.
create or replace function public.get_public_queue(p_store_slug text, p_code text)
returns table (entry_id uuid, motoboy_id uuid, name text, phone text, position integer, status text, entered_at timestamptz, called_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare v_store_id uuid;
begin
  select id into v_store_id from public.stores where slug = p_store_slug;
  if v_store_id is null then raise exception 'STORE_NOT_FOUND'; end if;
  if p_code is null or length(p_code) <> 4 then raise exception 'INVALID_CODE'; end if;
  return query select q.id, m.id, m.name, m.phone, q.position, q.status, q.entered_at, q.called_at
    from public.queue_entries q join public.motoboys m on m.id = q.motoboy_id
    where q.store_id = v_store_id and q.status in ('waiting', 'called', 'attending') order by q.position;
end;
$$;

grant execute on function public.join_queue(text, text, text) to anon, authenticated;
grant execute on function public.get_public_queue(text, text) to anon, authenticated;
