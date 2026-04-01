# Reminder SQL Playbook

前日リマインダー通知の運用・障害対応で使うSQL集です。  
基本は Supabase SQL Editor で実行します。

---

## 0) JSTの「今日/明日」確認

```sql
SELECT
  (now() AT TIME ZONE 'Asia/Tokyo')::date AS jst_today,
  ((now() AT TIME ZONE 'Asia/Tokyo')::date + 1) AS jst_tomorrow;
```

---

## 1) 明日予約の対象件数（送信前チェック）

```sql
WITH target_date AS (
  SELECT ((now() AT TIME ZONE 'Asia/Tokyo')::date + 1) AS d
)
SELECT
  r.tenant_id,
  COUNT(*) AS row_count,
  COUNT(DISTINCT COALESCE(r.group_id::text, r.id::text)) AS group_count
FROM reservations r
CROSS JOIN target_date t
WHERE r.date = t.d
  AND COALESCE(r.status, '') <> 'cancelled'
  AND COALESCE(r.reminder_sent, false) = false
GROUP BY r.tenant_id
ORDER BY row_count DESC;
```

---

## 2) 明日予約の詳細一覧（送信前/送信後確認）

```sql
WITH target_date AS (
  SELECT ((now() AT TIME ZONE 'Asia/Tokyo')::date + 1) AS d
)
SELECT
  r.id,
  r.group_id,
  r.tenant_id,
  r.user_id,
  r.user_name,
  r.date,
  r.time,
  r.status,
  r.reminder_sent,
  r.reminder_sent_at,
  r.reminder_error
FROM reservations r
CROSS JOIN target_date t
WHERE r.date = t.d
ORDER BY r.tenant_id, r.group_id NULLS LAST, r.time, r.id;
```

---

## 3) 失敗通知の確認（直近3日）

```sql
SELECT
  id,
  group_id,
  tenant_id,
  user_id,
  date,
  time,
  reminder_sent,
  reminder_sent_at,
  reminder_error
FROM reservations
WHERE reminder_error IS NOT NULL
  AND date >= ((now() AT TIME ZONE 'Asia/Tokyo')::date - 3)
ORDER BY date DESC, tenant_id, time;
```

---

## 3.5) LINE送達ログ確認（Phase5以降）

```sql
SELECT
  tenant_id,
  kind,
  ok,
  status_code,
  to_user_id,
  reservation_group_id,
  left(coalesce(error_body, ''), 200) AS error_preview,
  created_at
FROM line_delivery_logs
WHERE created_at >= (now() - interval '3 days')
ORDER BY created_at DESC;
```

---

## 4) 店舗設定の確認（有効化/テンプレート）

```sql
SELECT
  id AS tenant_id,
  name,
  reminder_enabled,
  CASE
    WHEN reminder_template IS NULL OR btrim(reminder_template) = '' THEN '(default template)'
    ELSE left(reminder_template, 120) || '...'
  END AS template_preview
FROM tenants
ORDER BY name;
```

---

## 5) user_id欠損（送信不能）チェック

```sql
WITH target_date AS (
  SELECT ((now() AT TIME ZONE 'Asia/Tokyo')::date + 1) AS d
)
SELECT
  id, group_id, tenant_id, date, time, user_id, user_name
FROM reservations r
CROSS JOIN target_date t
WHERE r.date = t.d
  AND COALESCE(r.status, '') <> 'cancelled'
  AND (r.user_id IS NULL OR btrim(r.user_id) = '')
ORDER BY tenant_id, time;
```

---

## 6) 特定日を再送対象へ戻す

```sql
UPDATE reservations
SET
  reminder_sent = false,
  reminder_sent_at = NULL,
  reminder_error = NULL
WHERE date = DATE '2026-04-01'
  AND COALESCE(status, '') <> 'cancelled';
```

---

## 7) 特定グループだけ再送対象へ戻す

```sql
UPDATE reservations
SET
  reminder_sent = false,
  reminder_sent_at = NULL,
  reminder_error = NULL
WHERE group_id = 'PUT-GROUP-ID-HERE';
```

---

## 8) 特定予約IDだけ再送対象へ戻す

```sql
UPDATE reservations
SET
  reminder_sent = false,
  reminder_sent_at = NULL,
  reminder_error = NULL
WHERE id = 'PUT-RESERVATION-ID-HERE';
```

