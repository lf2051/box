alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.motoboys enable row level security;
alter table public.queue_entries enable row level security;
alter table public.queue_history enable row level security;
alter table public.store_settings enable row level security;

create or replace function public.my_store_id() returns uuid language sql stable security definer set search_path = public as $$ select store_id from public.profiles where id = auth.uid() $$;
create policy stores_member on public.stores for select using (id = public.my_store_id());
create policy profiles_self on public.profiles for select using (id = auth.uid());
create policy motoboys_store on public.motoboys for all using (store_id = public.my_store_id()) with check (store_id = public.my_store_id());
create policy queue_store on public.queue_entries for all using (store_id = public.my_store_id()) with check (store_id = public.my_store_id());
create policy history_store on public.queue_history for all using (store_id = public.my_store_id()) with check (store_id = public.my_store_id());
create policy settings_store on public.store_settings for all using (store_id = public.my_store_id()) with check (store_id = public.my_store_id());

alter publication supabase_realtime add table public.queue_entries;
alter publication supabase_realtime add table public.queue_history;
alter publication supabase_realtime add table public.motoboys;
