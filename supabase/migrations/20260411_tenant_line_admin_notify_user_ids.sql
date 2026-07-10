-- 管理者向け LINE 通知先（複数可）。公式LINEの友だちである userId を登録する。
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS line_admin_notify_user_ids text[] NOT NULL DEFAULT '{}';
