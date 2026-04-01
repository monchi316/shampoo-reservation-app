# Phase 5: 企業ごと公式LINE運用 設計・実装計画

## 実装ステータス（2026-03-31 時点）

- [x] Step 1: DBマイグレーション
- [x] Step 2: 暗号化ユーティリティ追加
- [x] Step 3: 管理API追加
- [x] Step 4: 管理UI追加
- [x] Step 5: 送信基盤 tenant-aware 化
- [x] Step 6: 運用確認ドキュメント整備

実装済み主要ファイル:

- `supabase/migrations/20260401_phase5_tenant_line_channels.sql`
- `app/lib/secureLineCredentials.ts`
- `app/api/admin/tenant/line-channel/route.ts`
- `app/admin/settings/page.tsx`（LINE通知設定セクション）
- `app/lib/linePush.ts`（tenant-aware）
- `app/api/send-line/route.ts`
- `app/api/cancel-reservation/route.ts`
- `app/api/jobs/reservation-reminders/route.ts`

## 1. 背景と目的

現状は `LINE_CHANNEL_ACCESS_TOKEN` を1つだけ使う実装です。  
このままだと「全企業が同じ公式LINEアカウント」から通知されます。

今回の目的は、**tenant（店舗/企業）ごとに別の公式LINEアカウント**を使って通知できるようにすることです。

---

## 2. 完成形（実動イメージ）

- A社の予約は A社LINE公式アカウントから通知
- B社の予約は B社LINE公式アカウントから通知
- リマインダー/予約完了/変更/キャンセルすべて tenant 単位で送信元が切り替わる
- トークンは平文で返さず、管理画面では「登録済みかどうか」中心に管理

---

## 3. スコープ（このフェーズでやること）

1. tenantごとのLINEチャネル設定を保存できるようにする  
2. 通知送信処理を tenant-aware 化する  
3. 管理画面でLINE設定を更新できるようにする  
4. 既存通知（予約完了/変更、キャンセル、前日リマインダー）を新方式へ切替  
5. 運用・障害切り分けしやすいログを残す

---

## 4. 非スコープ（今回はやらない）

- LINE Official Account作成手順の自動化
- 外部KMS連携（まずはアプリ鍵で暗号化）
- きめ細かい通知テンプレートABテスト

---

## 5. データ設計

## 5.1 tenant_channels（既存活用または拡張）

想定カラム:

- `tenant_id uuid primary key`
- `line_liff_id text`
- `line_channel_id text`
- `line_channel_secret_enc text`
- `line_channel_access_token_enc text`
- `line_push_enabled boolean not null default true`
- `line_token_last4 text`
- `line_token_updated_at timestamptz`
- `created_at timestamptz`
- `updated_at timestamptz`

> メモ: `*_enc` は暗号化済み文字列を保存する。

## 5.2 line_delivery_logs（新規推奨）

- `id uuid primary key default gen_random_uuid()`
- `tenant_id uuid not null`
- `kind text not null` (`reservation_created` / `reservation_updated` / `cancelled` / `reminder`)
- `to_user_id text not null`
- `status_code int`
- `ok boolean not null`
- `error_body text`
- `reservation_group_id uuid null`
- `created_at timestamptz not null default now()`

---

## 6. セキュリティ設計

## 6.1 鍵管理

- 新規環境変数: `LINE_CREDENTIALS_ENCRYPTION_KEY`
  - 32byte以上のランダム文字列
  - `.env.local` と Vercel に設定

## 6.2 保存ポリシー

- Channel Secret / Access Token は暗号化してDB保存
- APIレスポンスに平文を返さない
- UIは「登録済み」「更新日時」「末尾4桁」だけ表示

## 6.3 権限制御

- 設定変更は owner/superadmin のみ
- 既存の `canManageTenantSettings` を利用

---

## 7. API設計

## 7.1 管理API（新規）

- `GET /api/admin/tenant/line-channel?tenantId=...`
  - 返却: `configured`, `line_liff_id`, `line_channel_id`, `line_push_enabled`, `line_token_last4`, `line_token_updated_at`

- `PUT /api/admin/tenant/line-channel?tenantId=...`
  - 入力: `line_liff_id`, `line_channel_id`, `line_channel_secret`, `line_channel_access_token`, `line_push_enabled`
  - secret/token は受領後に暗号化して保存

- `POST /api/admin/tenant/line-channel/test?tenantId=...`（任意）
  - テスト送信先 `userId` に試験通知

## 7.2 送信関数改修

- 現在: `lineMessagingPush(toUserId, text)`
- 変更後: `lineMessagingPush({ tenantId, toUserId, text, kind, groupId? })`
  - tenantごとの token 復号
  - tenantの `line_push_enabled=false` ならスキップ
  - `line_delivery_logs` に結果記録

---

## 8. 既存機能への反映箇所

- `app/components/PriceSummary.tsx`
  - `/api/send-line` 呼び出しに `tenantId` を渡す
- `app/api/send-line/route.ts`
  - tenantId受け取り、tenant-aware pushを呼ぶ
- `app/api/cancel-reservation/route.ts`
  - tenant-aware pushへ切替
- `app/api/jobs/reservation-reminders/route.ts`
  - tenant-aware pushへ切替（既にtenant_idは取得済み）

---

## 9. 実装順（明日以降の進め方）

## Step 1: DBマイグレーション

- `tenant_channels` 拡張
- `line_delivery_logs` 作成
- 既存 tenant 初期行（必要なら）投入

完了条件:
- SQL適用後、設定保存に必要な列が揃っている

## Step 2: 暗号化ユーティリティ追加

- `app/lib/secureLineCredentials.ts` 新規
  - `encryptText()`, `decryptText()`

完了条件:
- ローカルで暗号化→復号の往復が一致

## Step 3: 管理API追加

- `app/api/admin/tenant/line-channel/route.ts` 新規
- RBACとtenantアクセスチェックを適用

完了条件:
- GET/PUTで設定の保存・取得が可能

## Step 4: 管理UI追加

- `app/admin/settings/page.tsx` に「LINE通知設定」セクション追加

完了条件:
- ownerがUIから設定更新できる
- staffは編集不可

## Step 5: 送信基盤のtenant-aware化

- `app/lib/linePush.ts` 改修
- 既存3経路（予約完了/変更、キャンセル、リマインダー）を切替

完了条件:
- tenant A/B で送信先アカウントが分かれる

## Step 6: 運用確認とドキュメント

- 送信ログ確認SQL整備
- 既存ドキュメント更新

完了条件:
- 手動テストとCronテストの手順が文書化されている

---

## 10. テスト観点（最低限）

1. tenant A 予約 -> A社アカウントから通知される  
2. tenant B 予約 -> B社アカウントから通知される  
3. token未設定tenant -> 送信スキップ/エラーログ記録  
4. リマインダーCronでA/B混在日を処理できる  
5. 二重実行しても重複送信しない（既存冪等が維持される）

---

## 11. 想定リスクと対策

- **リスク:** token誤登録  
  - **対策:** テスト送信APIを用意し本番有効前に確認

- **リスク:** 暗号鍵ローテーション時に復号不能  
  - **対策:** 鍵ID管理（将来）または一括再暗号化手順を運用化

- **リスク:** tenant設定欠落で通知止まり  
  - **対策:** `line_delivery_logs` と管理画面の設定状態表示で早期検知

---

## 12. 明日開始時のチェックリスト

- [ ] `LINE_CREDENTIALS_ENCRYPTION_KEY` をローカル/本番に設定
- [ ] DB migration を適用
- [ ] Postman/curl で管理APIの保存・取得を確認
- [ ] A社/B社の2tenantで実送信確認
- [ ] `line_delivery_logs` / `reminder_sql_playbook` で運用監視確認

---

## 14. 検証手順（A社/B社）

1. A社tenantでLINE設定を保存（LIFF ID / Channel ID / Secret / Access Token）
2. B社tenantでも同様に保存
3. A社予約を作成し、A社公式LINEから通知されることを確認
4. B社予約を作成し、B社公式LINEから通知されることを確認
5. 前日リマインダーJobを手動実行し、A/Bの各LINEで受信確認
6. `line_delivery_logs` で `tenant_id` ごとに送達結果を確認

---

## 13. 参照ドキュメント

- `docs/phase4_reminder_notifications.md`
- `docs/reminder_sql_playbook.md`

