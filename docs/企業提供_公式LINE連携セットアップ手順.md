# 企業提供向け 公式LINE連携セットアップ手順

この手順書は、**初めて操作する人でも迷わない**ことを目的にしています。  
「企業ごとに公式LINEを分けて」この予約アプリを使ってもらうための準備をまとめています。

---

## 0. 最初に理解しておくこと

このアプリは、企業（店舗）ごとに次の情報を使って通知します。

- `LIFF ID`（LINE内で予約画面を開くため）
- `Channel ID`
- `Channel Secret`
- `Channel Access Token`（LINE通知送信に使う）

これらは最終的に、管理画面の `店舗設定 > LINE通知設定（企業別）` に登録します。  
トークン/シークレットは暗号化保存され、画面に平文再表示されません。

---

## 1. 事前に用意するもの（チェックリスト）

- [ ] 企業側のLINE公式アカウント（Messaging APIチャネル）
- [ ] そのチャネルに紐づく LIFF アプリ
- [ ] 企業の店舗URL（本番の予約URL）
- [ ] このアプリの管理画面ログイン権限（owner 以上）

---

## 2. LINE Developers 側の設定（企業担当）

## 2-1. プロバイダー作成（未作成なら）

1. [LINE Developers](https://developers.line.biz/console/) にログイン
2. 企業名でプロバイダーを作成

## 2-2. Messaging API チャネル作成

1. 作成したプロバイダー内で「Messaging API」を作成
2. 作成後、以下を控える
   - `Channel ID`
   - `Channel Secret`

## 2-3. Channel Access Token 発行

1. Messaging API設定画面で `Channel access token` を発行
2. 発行したトークン文字列を控える

> 注意: ここで作ったトークンが通知送信の鍵です。外部共有は厳禁です。

## 2-4. LIFFアプリ作成

1. LIFFタブで新しいLIFFアプリを作成
2. LIFF URL には企業用の予約URLを設定
   - 例: `https://your-app.vercel.app/reserve?tenantId=<企業tenant_id>&lid=<LIFF_ID>`
3. 作成後、`LIFF ID` を控える

---

## 3. このアプリ側（管理画面）での登録

## 3-1. 管理画面へログイン

1. `https://<your-domain>/admin/login`
2. owner（またはsuperadmin）でログイン

## 3-2. 対象店舗を選択

1. 画面上部の店舗セレクタで対象企業を選択

## 3-3. 店舗設定 > LINE通知設定（企業別）

以下を入力して保存:

- `LIFF ID`（2-4で取得）
- `Channel ID`（2-2で取得）
- `Channel Secret`（2-2で取得）
- `Channel Access Token`（2-3で取得）
- `LINE Push 通知を有効化` を ON

保存後の確認:

- `状態: 設定済み`
- `token末尾: ****1234` のような表示

---

## 4. URL設定（リッチメニュー/配布リンク）

企業ごとに、次のような予約リンクを使います。

- 予約リンク（例）
  - `https://your-app.vercel.app/reserve?tenantId=<企業tenant_id>&lid=<企業LIFF_ID>`

ポイント:

- `tenantId` と `lid` の組み合わせが企業別ルーティングの鍵
- 同じ企業には常に同じリンクを配布する

---

## 5. 動作確認（必須）

## 5-1. 予約通知テスト

1. 実際に企業リンクから予約を1件作成
2. 企業の公式LINEアカウント名で通知が届くか確認

## 5-2. 前日リマインダーテスト

1. 明日予約を1件作成
2. 手動でジョブ実行（Bearer付き）
3. 通知受信とDB反映を確認

---

## 6. 必要な環境変数（運用側）

企業ごとの token 自体はDBに入ります。  
環境変数側に必要なのは「復号鍵などの共通値」です。

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SESSION_SECRET`
- `REMINDER_CRON_SECRET`（または `CRON_SECRET`）
- `LINE_CREDENTIALS_ENCRYPTION_KEY`（重要）
- `NEXT_PUBLIC_BASE_URL`

詳細は `docs/environment_keys_reference.md` を参照。

---

## 7. よくあるつまずき

## 症状1: 保存したのに通知が飛ばない

確認:

- 店舗設定の `LINE Push 通知を有効化` がONか
- `line_channel_access_token` を入力して保存したか
- `LINE_CREDENTIALS_ENCRYPTION_KEY` が本番に設定されているか

## 症状2: 通知は飛ぶが別アカウント名で届く

確認:

- その tenant の `Channel Access Token` が正しい企業のものか
- 店舗セレクタで別tenantを編集中に保存していないか

## 症状3: LIFFで開く店舗が違う

確認:

- リンクの `tenantId` と `lid` が一致しているか
- リッチメニューURLが古いままになっていないか

---

## 8. 企業ごと導入テンプレート（コピーして使う）

- 企業名:
- tenant_id:
- 予約URL:
- LIFF ID:
- Channel ID:
- Channel Secret:（管理対象）
- Channel Access Token:（管理対象）
- LINE通知有効化: ON/OFF
- テスト予約実施日:
- 通知受信確認: OK / NG

---

## 9. 参考ドキュメント

- `docs/environment_keys_reference.md`
- `docs/phase4_reminder_notifications.md`
- `docs/reminder_sql_playbook.md`
- `docs/phase5_per_tenant_line_channels_plan.md`

