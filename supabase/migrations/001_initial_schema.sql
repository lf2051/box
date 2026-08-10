create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  logo_url text, accent_color text not null default '#FFC107', estimated_service_time integer not null default 10,
  call_phrase text not null default '{name}, favor retirar o pedido.', call_repeat integer not null default 3,
  attendance_timeout integer not null default 5, allow_voluntary_exit boolean not null default true,
  allow_new_entries boolean not null default true, tv_positions integer not null default 7,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, name text not null default '', email text,
  role text not null default 'operator' check (role in ('admin','leader','operator')), store_id uuid not null references public.stores(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.motoboys (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  name text not null, phone text not null, plate text not null default '', motorcycle_model text not null default '', observations text,
  status text not null default 'active' check (status in ('active','inactive')), last_access_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.queue_entries (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  motoboy_id uuid not null references public.motoboys(id), position integer not null, status text not null default 'waiting'
    check (status in ('waiting','called','attending','completed','skipped','cancelled','absent')),
  entered_at timestamptz not null default now(), called_at timestamptz, service_started_at timestamptz,
  finished_at timestamptz, cancelled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.queue_history (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete cascade,
  queue_entry_id uuid not null references public.queue_entries(id), motoboy_id uuid not null references public.motoboys(id),
  action text not null, previous_status text, new_status text, reason text, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create table if not exists public.store_settings (store_id uuid primary key references public.stores(id) on delete cascade, theme text not null default 'dark', volume integer not null default 80, updated_at timestamptz not null default now());
