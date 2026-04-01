-- Phase 5 Step 1
-- tenantごとに公式LINEチャネルを持つための土台

create extension if not exists pgcrypto;

-- 既存 tenant_channels を拡張
alter table public.tenant_channels
add column if not exists line_channel_id text;

alter table public.tenant_channels
add column if not exists line_channel_secret_enc text;

alter table public.tenant_channels
add column if not exists line_channel_access_token_enc text;

alter table public.tenant_channels
add column if not exists line_push_enabled boolean not null default true;

alter table public.tenant_channels
add column if not exists line_token_last4 text;

alter table public.tenant_channels
add column if not exists line_token_updated_at timestamptz;

-- 送達履歴（障害切り分け用）
create table if not exists public.line_delivery_logs (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    kind text not null check (kind in ('reservation_created', 'reservation_updated', 'cancelled', 'reminder', 'test')),
    to_user_id text not null,
    status_code int,
    ok boolean not null,
    error_body text,
    reservation_group_id uuid,
    created_at timestamptz not null default now()
);

create index if not exists idx_line_delivery_logs_tenant_created_at
    on public.line_delivery_logs (tenant_id, created_at desc);

create index if not exists idx_line_delivery_logs_kind_created_at
    on public.line_delivery_logs (kind, created_at desc);

create unique index if not exists tenant_channels_tenant_channel_type_unique
    on public.tenant_channels (tenant_id, channel_type);

