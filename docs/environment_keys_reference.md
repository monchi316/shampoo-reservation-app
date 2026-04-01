# Environment Keys Reference

このドキュメントは、環境変数を **どこに置くか** と **何に使うか** を整理したものです。  
（質問の `.evn.local` は `.env.local` のこととして記載）

---

## 1) `.env.local`（ローカル開発）

ローカル実行時に使う値です。  
`.env.local` は `.gitignore` で除外されているため、通常はGitに入りません。

### クライアント公開系（`NEXT_PUBLIC_`）

- `NEXT_PUBLIC_SUPABASE_URL`
  - 用途: ブラウザ側 Supabase SDK 接続先
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - 用途: ブラウザ側 Supabase anon キー
- `NEXT_PUBLIC_LIFF_ID`
  - 用途: LIFF初期化のデフォルトID（tenant未解決時の補助）
- `NEXT_PUBLIC_API_BASE_URL`
  - 用途: 一部画面からAPIを絶対URLで呼ぶときのベース
- `NEXT_PUBLIC_BASE_URL`
  - 用途: LINEメッセージ内リンク（編集/キャンセルURL）生成
- `NEXT_PUBLIC_DEFAULT_TENANT_ID`
  - 用途: tenant未指定時のフォールバック

### サーバー専用（機密）

- `SUPABASE_URL`
  - 用途: サーバーAPIから Supabase service role 接続
- `SUPABASE_SERVICE_ROLE_KEY`
  - 用途: サーバーAPIでDB操作（RLS回避）
- `ADMIN_SESSION_SECRET`
  - 用途: 管理画面セッション署名（JWT相当）
- `REMINDER_CRON_SECRET`（または `CRON_SECRET`）
  - 用途: CronジョブAPI認証（Bearer）
- `LINE_CREDENTIALS_ENCRYPTION_KEY`
  - 用途: tenantごとのLINE token/secret暗号化・復号

### 旧方式（単一LINE運用）のキー

- `LINE_CHANNEL_ACCESS_TOKEN`
  - 現在: tenant別LINE運用では基本未使用（後方互換用途がなければ削除可能）

---

## 2) Vercel Environment Variables（本番/Preview）

本番で必要なキーです。  
基本は `.env.local` のサーバー用キーを同名で設定します。

### 必須

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SESSION_SECRET`
- `REMINDER_CRON_SECRET`（または `CRON_SECRET`）
- `LINE_CREDENTIALS_ENCRYPTION_KEY`
- `NEXT_PUBLIC_BASE_URL`（例: `https://your-app.vercel.app`）

### tenant別LINE運用での補足

- tenantごとのアクセストークンは `tenant_channels.line_channel_access_token_enc` に保存
- Vercelには各tenant分の token を直接置かない（暗号鍵のみ）

---

## 3) Supabase Functions（将来/任意）

現時点の実装は **Next.js API Route中心** なので、Supabase Functions必須ではありません。  
もし将来 Functions 側で同等処理を行う場合は、最低限以下を secrets として設定します。

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINE_CREDENTIALS_ENCRYPTION_KEY`
- `NEXT_PUBLIC_BASE_URL`（または別名 `BASE_URL`）
- `REMINDER_CRON_SECRET`（外部から叩く設計の場合）

---

## 4) セキュリティ運用（重要）

- `ADMIN_SESSION_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` / `REMINDER_CRON_SECRET` / `LINE_CREDENTIALS_ENCRYPTION_KEY` は機密情報
- **Gitにコミットしない**
- 漏えいの疑いがある場合は即ローテーション（新値発行→Vercel更新→再デプロイ）

---

## 5) 「ADMIN_SESSION_SECRETをGitに残せるか？」への回答

結論:

- 通常は **残せません（残すべきではありません）**
- このリポジトリでは `.env*` が `.gitignore` 対象なので、通常の `git add .` では追加されません
- 仮に `git add -f .env.local` で入れることは技術的には可能ですが、**セキュリティ上NG** です

推奨:

- `.env.local` と Vercel Environment Variables のみに保持
- チーム共有はパスワードマネージャで行う

