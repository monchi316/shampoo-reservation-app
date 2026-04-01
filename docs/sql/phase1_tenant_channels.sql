-- Phase 1: LIFF -> tenant_id 解決テーブル
-- 実行場所: Supabase Dashboard > SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.tenant_channels (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    channel_type text not null default 'line_liff' check (channel_type in ('line_liff')),
    liff_id text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists tenant_channels_liff_id_unique
    on public.tenant_channels (liff_id);

create index if not exists tenant_channels_tenant_id_idx
    on public.tenant_channels (tenant_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tenant_channels_updated_at on public.tenant_channels;
create trigger trg_tenant_channels_updated_at
before update on public.tenant_channels
for each row execute function public.set_updated_at();

-- ---- LIFF と tenant の紐付け（例）
-- 既存 tenant_id / liff_id に置き換えて実行してください
--
-- insert into public.tenant_channels (tenant_id, liff_id, is_active)
-- values
--   ('00000000-0000-4000-8000-000000000001', '2001234567-abcDEFgh', true);
