-- Phase 2: 管理画面オペレーターと店舗（tenant）単位の認可

create table if not exists public.admin_operators (
    id uuid primary key default gen_random_uuid (),
    email text not null,
    display_name text,
    password_hash text not null,
    is_active boolean not null default true,
    is_superadmin boolean not null default false,
    created_at timestamptz not null default now()
);

create unique index if not exists admin_operators_email_lower on public.admin_operators (lower(email));

create table if not exists public.admin_operator_tenants (
    operator_id uuid not null references public.admin_operators (id) on delete cascade,
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    primary key (operator_id, tenant_id)
);

create index if not exists admin_operator_tenants_tenant_id_idx
    on public.admin_operator_tenants (tenant_id);

comment on table public.admin_operators is '管理画面ログイン用（Phase 2）';
comment on table public.admin_operator_tenants is 'オペレーターが操作可能な tenant_id（is_superadmin の場合は不要）';
