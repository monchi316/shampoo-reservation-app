# Phase 4: 前日リマインダー通知（LINE）

## 要約

- 予約前日に、対象ユーザーへ LINE Push リマインダーを送るジョブを実装しました。
- JST 固定で「明日」の予約を抽出します（サーバーが UTC でもブレない）。
- `reminder_sent` を使って冪等化し、同じ予約への二重送信を防ぎます。
- LINE ブロック/友だち解除などの失敗はジョブ全体を落とさず、DBへ記録します。
- 店舗ごとに通知文面を差し替えられるよう、`tenants.reminder_template` を導入しました。

---

## 実装ファイル

- `app/api/jobs/reservation-reminders/route.ts`
  - Cron 実行用 API（GET）
  - 明日予約の抽出、tenant設定読み込み、メッセージ作成、LINE送信、送信結果更新
- `app/api/admin/tenant/scheduling/route.ts`
  - 管理画面から `reminder_enabled` / `reminder_template` を保存・取得
- `app/admin/settings/page.tsx`
  - リマインダー有効化チェックボックス
  - テンプレート編集 textarea
- `supabase/migrations/20260331_reservation_reminder_revival.sql`
  - 予約通知と店舗テンプレート用の列追加
- `vercel.json`
  - Vercel Cron 設定

---

## DB変更

### reservations

- `reminder_sent boolean not null default false`
- `reminder_sent_at timestamptz`
- `reminder_error text`

### tenants

- `reminder_enabled boolean not null default true`
- `reminder_template text`

---

## ジョブ仕様

### 抽出条件

- `date = JST の明日`
- `status != cancelled`
- `reminder_sent IS NULL OR reminder_sent = false`

### 送信単位

- 1予約行ごとではなく、`group_id`（なければ `id`）単位で 1通送信  
  （複数台予約でも通知が重複しない）

### 冪等性

- 成功時は対象行を `reminder_sent=true` に更新し、再実行時は対象外
- 同日のジョブ再実行でも二重送信を防止

### 失敗時挙動

- 再試行不要系（HTTP 400/403/404）は「送達不能」とみなし完了扱い
  - `reminder_sent=true`
  - `reminder_error` に詳細記録
- それ以外は未送信のままエラー記録（次回再試行可能）

---

## 店舗ごとのテンプレート

`tenants.reminder_template` に以下プレースホルダを設定できます:

- `{{customer_name}}`
- `{{tenant_name}}`
- `{{reservation_date}}`
- `{{reservation_time}}`
- `{{cars_summary}}`
- `{{address}}`
- `{{edit_url}}`
- `{{cancel_url}}`

未設定時は標準テンプレートを使用します。

---

## 環境変数

- `LINE_CREDENTIALS_ENCRYPTION_KEY`（Phase5以降、tenant token復号に必須）
- `REMINDER_CRON_SECRET`（新規・必須）
- `NEXT_PUBLIC_BASE_URL`（既存、通知内リンク生成に利用）

> Phase5（企業ごと公式LINE）適用後は、`LINE_CHANNEL_ACCESS_TOKEN` の単一運用ではなく  
> `tenant_channels.line_channel_access_token_enc`（暗号化保存）を参照して tenant ごとに送信します。

---

## Vercel設定

`vercel.json` にて以下を設定済み:

- `0 9 * * *`（UTC）= 毎日 18:00 JST 実行
- 呼び出し先: `/api/jobs/reservation-reminders`

※ Cron からの呼び出しには `Authorization: Bearer <REMINDER_CRON_SECRET>` を付与する運用を想定

---

## 手動確認手順

1. マイグレーションを適用
2. 管理画面 > 店舗設定でリマインダーを有効化
3. 明日予約を1件作成（`reminder_sent=false`）
4. ジョブAPIを手動実行（秘密ヘッダ付き）
5. LINE受信、および DB の `reminder_sent/reminder_sent_at/reminder_error` を確認

---

## 運用SQL集

日々の確認・障害対応・再送オペレーションは以下を参照してください。

- `docs/reminder_sql_playbook.md`

