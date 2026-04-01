# Phase 1 セットアップ手順（予約側のみ）

## 1. Supabase に SQL を反映

1. Supabase Dashboard を開く
2. `SQL Editor` を開く
3. `docs/sql/phase1_tenant_channels.sql` の内容をコピペして実行
4. 実行後、`tenant_channels` テーブルに各企業の `tenant_id` と `liff_id` を登録

## 2. リッチメニューの URL 形式を変更

予約ボタンの URL は、`lid` を付けてください。

例:

```
https://<your-domain>/reserve?lid=<LIFF_ID>
```

- `<LIFF_ID>` はその企業の LIFF ID
- `tenant_id` は URL に直接書かず、サーバーで `lid -> tenant_id` 解決します

## 3. 予約変更/キャンセルリンク

この実装で、予約完了メッセージのリンクに `tenantId` が自動付与されるようになっています。
特別な追加設定は不要です。

## 4. ローカル確認（手動テスト）

1. `tenant_channels` に対象 LIFF ID が登録されていることを確認
2. `http://localhost:3000/reserve?lid=<LIFF_ID>` を開く
3. メニュー表示・空き確認・予約作成が対象 tenant に入ることを確認
4. 予約完了通知の変更/キャンセルリンクが動作することを確認

## 5. 注意点

- この Phase 1 は「予約側のみ tenant 動的化」です
- 管理側 `/admin` の **ログイン・店舗切替・API 認可** は **Phase 2**（[phase2_admin_multitenant.md](./phase2_admin_multitenant.md)）で対応します
