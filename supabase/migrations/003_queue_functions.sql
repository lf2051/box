create unique index if not exists queue_active_motoboy on public.queue_entries(motoboy_id) where status in ('waiting','called','attending');
create index if not exists queue_store_status_position on public.queue_entries(store_id, status, position);
create index if not exists history_store_created on public.queue_history(store_id, created_at desc);

create or replace function public.join_queue(p_store_slug text, p_name text, p_phone text)
returns json language plpgsql security definer set search_path = public as $$
declare v_store stores; v_moto motoboys; v_entry queue_entries; v_position integer;
begin
  select * into v_store from stores where slug = p_store_slug;
  if v_store.id is null or not v_store.allow_new_entries then raise exception 'ENTRIES_CLOSED'; end if;
  select * into v_moto from motoboys where store_id = v_store.id and lower(phone) = lower(p_phone) limit 1;
  if v_moto.id is null then insert into motoboys(store_id,name,phone) values(v_store.id,p_name,p_phone) returning * into v_moto; end if;
  if exists(select 1 from queue_entries where motoboy_id = v_moto.id and status in ('waiting','called','attending')) then raise exception 'ALREADY_IN_QUEUE'; end if;
  select coalesce(max(position),0)+1 into v_position from queue_entries where store_id = v_store.id and status in ('waiting','called','attending');
  insert into queue_entries(store_id,motoboy_id,position) values(v_store.id,v_moto.id,v_position) returning * into v_entry;
  return json_build_object('entry_id',v_entry.id,'motoboy_id',v_moto.id,'position',v_position);
end $$;

create or replace function public.call_next(p_store_id uuid)
returns public.queue_entries language plpgsql security invoker set search_path = public as $$
declare v_entry queue_entries;
begin
  select * into v_entry from queue_entries where store_id = p_store_id and status = 'waiting' order by position for update skip locked limit 1;
  if v_entry.id is null then return null; end if;
  update queue_entries set status='called', called_at=now(), updated_at=now() where id=v_entry.id returning * into v_entry;
  insert into queue_history(store_id,queue_entry_id,motoboy_id,action,previous_status,new_status,created_by) values(v_entry.store_id,v_entry.id,v_entry.motoboy_id,'call','waiting','called',auth.uid());
  return v_entry;
end $$;

create or replace function public.enter_queue(p_store_id uuid, p_motoboy_id uuid)
returns public.queue_entries language plpgsql security invoker set search_path = public as $$
declare v_entry queue_entries; v_position integer;
begin
  if not exists(select 1 from motoboys where id = p_motoboy_id and store_id = p_store_id and status = 'active') then raise exception 'MOTOBOY_INVALID'; end if;
  if exists(select 1 from queue_entries where motoboy_id = p_motoboy_id and status in ('waiting','called','attending')) then raise exception 'ALREADY_IN_QUEUE'; end if;
  select coalesce(max(position),0)+1 into v_position from queue_entries where store_id = p_store_id and status in ('waiting','called','attending');
  insert into queue_entries(store_id,motoboy_id,position) values(p_store_id,p_motoboy_id,v_position) returning * into v_entry;
  insert into queue_history(store_id,queue_entry_id,motoboy_id,action,new_status,created_by) values(p_store_id,v_entry.id,p_motoboy_id,'enter','waiting',auth.uid());
  return v_entry;
end $$;
