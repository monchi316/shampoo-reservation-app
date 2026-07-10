-- 予約完了・変更完了のLINE文面（未設定時はアプリ標準テンプレ）
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS line_message_template_reservation_complete text,
  ADD COLUMN IF NOT EXISTS line_message_template_reservation_change text;
