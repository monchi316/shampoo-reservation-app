-- Phase 2b: オーナー / スタッフのロール（管理画面の操作範囲）

alter table public.admin_operators
    add column if not exists role text;

comment on column public.admin_operators.role is 'owner=店舗設定まで可, staff=予約・売上のみ。is_superadmin=true のときは NULL';

-- 既存行: 非スーパーはオーナー扱い
update public.admin_operators
set role = 'owner'
where role is null
  and coalesce(is_superadmin, false) = false;

-- スーパー管理者は role を持たない
update public.admin_operators
set role = null
where coalesce(is_superadmin, false) = true;

alter table public.admin_operators
    add constraint admin_operators_role_scope_chk check (
        (coalesce(is_superadmin, false) = true and role is null)
        or (coalesce(is_superadmin, false) = false and role in ('owner', 'staff'))
    );
