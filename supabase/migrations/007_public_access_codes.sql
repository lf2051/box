-- Código temporário da loja persistido no Supabase, não no navegador do líder.
create table if not exists public.store_access_codes (
  store_id uuid primary key references public.stores(id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$'),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.store_access_codes enable row level security;

create or replace function public.rotate_store_access_code(p_store_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if public.my_store_id() is distinct from p_store_id then raise exception 'STORE_ACCESS_DENIED'; end if;
  v_code := lpad((floor(random() * 10000))::integer::text, 4, '0');
  insert into public.store_access_codes(store_id, code, expires_at, updated_at)
  values (p_store_id, v_code, now() + interval '20 seconds', now())
  on conflict (store_id) do update set code = excluded.code, expires_at = excluded.expires_at, updated_at = now();
  return v_code;
end;
$$;

create or replace function public.join_public_queue(p_store_slug text, p_name text, p_phone text, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_store_id uuid;
begin
  select id into v_store_id from public.stores where slug = p_store_slug;
  if v_store_id is null then raise exception 'STORE_NOT_FOUND'; end if;
  if exists (select 1 from public.store_access_codes where store_id = v_store_id)
    and not exists (select 1 from public.store_access_codes where store_id = v_store_id and code = p_code and expires_at >= now()) then
    raise exception 'ACCESS_CODE_EXPIRED';
  end if;
  return public.join_queue(p_store_slug, p_name, p_phone);
end;
$$;

grant execute on function public.rotate_store_access_code(uuid) to authenticated;
grant execute on function public.join_public_queue(text, text, text, text) to anon, authenticated;
