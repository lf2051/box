-- Leitura da fila pelo aplicativo público do motoboy.
create or replace function public.get_public_queue(p_store_slug text, p_code text)
returns table (entry_id uuid, motoboy_id uuid, name text, phone text, queue_position integer, status text, entered_at timestamptz, called_at timestamptz)
language sql security definer set search_path = public
as 'select q.id, m.id, m.name, m.phone, q.position, q.status, q.entered_at, q.called_at
    from public.queue_entries q
    join public.motoboys m on m.id = q.motoboy_id
    join public.stores s on s.id = q.store_id
    where s.slug = p_store_slug
      and length(coalesce(p_code, '''')) = 4
      and q.status in (''waiting'', ''called'', ''attending'')
    order by q.position';

grant execute on function public.join_queue(text, text, text) to anon, authenticated;
grant execute on function public.get_public_queue(text, text) to anon, authenticated;
