-- テナント単位の機能ON/OFF + 車両の色（略称）・ナンバー（フル保存、管理画面は下4桁表示）

create table if not exists public.tenant_feature_flags (
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    feature_key text not null,
    enabled boolean not null default false,
    primary key (tenant_id, feature_key)
);

create index if not exists tenant_feature_flags_tenant_id_idx
    on public.tenant_feature_flags (tenant_id);

comment on table public.tenant_feature_flags is 'テナントごとの機能フラグ（例: vehicle_color_plate）';

alter table public.reservations
    add column if not exists vehicle_color_abbr text,
    add column if not exists vehicle_plate text;

comment on column public.reservations.vehicle_color_abbr is '車の色（略称）。ユーザー入力をそのまま保存。';
comment on column public.reservations.vehicle_plate is 'ナンバー全文。管理画面では下4桁のみ表示。';

-- 特定テナントのみ有効化する例（Supabase SQL Editor で name を合わせて実行）:
-- insert into public.tenant_feature_flags (tenant_id, feature_key, enabled)
-- select id, 'vehicle_color_plate', true from public.tenants where name = 'Demo'
-- on conflict (tenant_id, feature_key) do update set enabled = excluded.enabled;
