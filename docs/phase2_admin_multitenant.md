# Phase 2: 管理画面のマルチテナント＋認可＋ロール

## 要約（1分で読む）

| 項目 | 内容 |
|------|------|
| **目的** | 店舗（`tenant_id`）ごとに管理画面を分け、**他人の店データに触れない**ようにする |
| **ログイン** | メール＋パスワード → **Cookie**（`ADMIN_SESSION_SECRET` で署名） |
| **店舗の切替** | 画面上部のセレクト。API は **`?tenantId=`** で対象店舗を指定 |
| **ロール** | **オーナー**＝店舗設定・メニュー・スケジュール・ロゴ・**スタッフ登録**まで可。**スタッフ**＝**予約・売上のみ**。**スーパー管理者**＝全店舗（社内用） |
| **初回オーナー** | パスワードは **ハッシュを生成して SQL で INSERT**（アプリからは登録しない） |
| **スタッフ追加** | **オーナー／スーパー管理者**が `/admin/staff` からメール・初期パスワードで登録（API がサーバー側でハッシュ化） |
| **パスワード運用** | 各オペレーターは `/admin/account` で変更。オーナーは `/admin/staff` でスタッフの再設定可 |

---

## 目的（何を解決するか）

Phase 1 では **予約（公開）側** を `tenant_id` / LIFF（`lid`）で店舗ごとに動かすところまでがスコープでした。

一方、当初の管理画面の API は **`DEFAULT_TENANT_ID` 固定**だったため、2店舗目の設定や予約一覧を扱えませんでした。

**Phase 2** で次を実現します。

1. **認可**  
   - ログイン済みかつ、**そのオペレーターが許可された `tenant_id` だけ** API が成功する（`tenantId` の改ざんで他店に触れない）。

2. **テナント切替**  
   - 画面上部で店舗を選び、**`?tenantId=<uuid>`** で API に渡す。

3. **ロール（オーナー / スタッフ）**  
   - **オーナー**: 店舗設定・メニュー・スケジュール・ロゴ・**スタッフの追加・無効化**（スタッフのみ無効化可）。  
   - **スタッフ**: **予約管理・売上**のみ。店舗設定 API は **403**。  
   - **スーパー管理者**（`is_superadmin`）: 全店舗＋オーナーの無効化も可（運用は SQL で付与）。

4. **スタッフの登録**  
   - オーナーが **管理画面「スタッフ管理」** から追加。パスワードは **サーバーで `scrypt` ハッシュ**して保存（手元で `phase2-hash-password` を回す必要なし）。

5. **初回のオーナー／社内管理者**  
   - 引き続き **ハッシュ生成 → SQL で `admin_operators` に INSERT** が確実（メールは小文字推奨）。

---

## 前提（Phase 1 との関係）

- `tenants` / `tenant_channels` / 予約側の `tenant_id` 解決は Phase 1 のまま利用します。  
- Phase 2 は **管理側** のテーブル `admin_operators` / `admin_operator_tenants` と API です。

---

## マイグレーション（Supabase）

1. `20260331_phase2_admin_operators.sql`（オペレーターと店舗紐付け）  
2. `20260331_phase2b_admin_operator_roles.sql`（**`role` 列**: `owner` / `staff`、スーパー管理者は `role` が NULL）

適用後、既存の非スーパー行は **`role = 'owner'`** に更新されます。

---

## セットアップ手順

### 1. 環境変数（サーバー専用）

`.env.local` および **Vercel の Environment Variables** に設定します。

```bash
# 32文字以上のランダム文字列（例: openssl rand -base64 48）
ADMIN_SESSION_SECRET=（長いランダム値）
```

本番でも必須です。**Git にコミットしないでください。**

### 2. 初回オペレーター（オーナー）を SQL で作成

1. パスワードハッシュを生成:

   ```bash
   node scripts/phase2-hash-password.mjs 'あなたの強力なパスワード'
   ```

2. `admin_operators` に INSERT（**`role = 'owner'`** を付与。メールは **小文字** 推奨）。

   ```sql
   insert into public.admin_operators (email, display_name, password_hash, is_active, is_superadmin, role)
   values (
     'admin@example.com',
     '管理者',
     '（scripts/phase2-hash-password.mjs の出力を貼る）',
     true,
     false,
     'owner'
   )
   returning id;
   ```

3. 店舗を紐づける:

   ```sql
   insert into public.admin_operator_tenants (operator_id, tenant_id)
   values ('<operatorのuuid>', '<tenants.id>');
   ```

**全店舗を触れる社内用アカウント** にする場合は、`is_superadmin = true`（このとき `role` は **NULL**）。`admin_operator_tenants` は不要ですが、あっても問題ありません。

### 3. アプリの確認

1. `/admin/login` にログイン  
2. 店舗セレクトで対象店舗を選択  
3. **オーナー**: 店舗設定・スタッフ管理が使える  
4. **スタッフ**（後述の画面で追加）: 予約・売上のみ  

---

## スタッフの追加（オーナー向け）

1. オーナーでログインし、**「スタッフ」** または **管理トップの「スタッフ管理」** を開く（`/admin/staff`）。  
2. メール・初期パスワード（8文字以上）・表示名（任意）を入力して登録。  
3. スタッフは **予約・売上のみ**（店舗設定・メニュー・スケジュール・ロゴ・スタッフ管理は不可）。  
4. オーナーは **スタッフ** のみ **無効化** 可能。オーナー行の無効化は **スーパー管理者のみ**。
5. 各オペレーターは **`/admin/account`** で自分のパスワードを変更可能。オーナーはスタッフのパスワード再設定も可能。

---

## API 一覧（参考）

| 用途 | メソッド | パス | 備考 |
|------|----------|------|------|
| ログイン | POST | `/api/admin/auth/login` | |
| 自分のPW変更 | POST | `/api/admin/auth/change-password` | body: `currentPassword`, `newPassword` |
| セッション | GET | `/api/admin/auth/session` | `operator.role` を返す |
| スタッフ一覧 | GET | `/api/admin/operators?tenantId=` | オーナー／スーパー管理者 |
| スタッフ追加 | POST | `/api/admin/operators?tenantId=` | body: `email`, `password`, `displayName?` |
| 無効化 | PATCH | `/api/admin/operators/[id]?tenantId=` | body: `{ "isActive": false }` |
| スタッフPW再設定 | POST | `/api/admin/operators/[id]/password?tenantId=` | body: `{ "newPassword": "..." }` |
| 店舗設定系 | 各種 | `/api/admin/tenant/*` | **オーナー／スーパー管理者のみ** |
| 予約・売上 | 各種 | `/api/admin/reservations`, `/api/admin/sales` | オーナー・スタッフ可 |

---

## 手動テストチェックリスト

- [ ] 未ログインで `/admin` → `/admin/login`  
- [ ] オーナーで店舗設定・スタッフ追加ができる  
- [ ] スタッフで `/admin/settings` が「権限なし」になる  
- [ ] `tenantId` を改ざんしても他店の API が **403**  
- [ ] Vercel に `ADMIN_SESSION_SECRET` を設定し、本番ログインできる  

---

## セキュリティ注意

- `ADMIN_SESSION_SECRET` を漏らさない  
- オーナーは最小限の店舗だけ `admin_operator_tenants` に付与  
- スタッフの初期パスワードは、運用で **初回ログイン後に変更** させる運用を推奨（パスワード変更 UI は未実装）

---

## Phase 3 以降で足しやすいもの

- オーナー／スタッフの **パスワード変更・リセットメール**  
- 監査ログ、2FA  
- Supabase Auth との統合（現状は `admin_operators` のみ）
