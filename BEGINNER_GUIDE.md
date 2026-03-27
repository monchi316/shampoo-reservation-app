# 洗車予約アプリ 初心者ガイド

このドキュメントは、プログラミング未経験の方向けに
「このアプリがどう動くか」をやさしくまとめたものです。

## 1) このアプリでできること

- LINE（LIFF）でログインする
- 洗車予約を登録する
- 予約完了後、LINEに次のリンク付きメッセージが届く
  - 予約変更リンク
  - 予約キャンセルリンク
- 後からリンク経由で予約を変更・キャンセルできる

## 2) 全体の流れ（ざっくり）

1. `/` を開く
   - LINEログインの初期化を行う
   - ユーザー情報をブラウザに保存する
2. `/reserve` に進む
   - ステップ形式の予約フォームを入力する
3. 予約を確定する
   - Supabaseに予約データを保存する
   - 手入力の新しい車種なら `cars` テーブルにも追加する
   - LINE通知APIを呼び出してメッセージ送信する
4. キャンセルリンクを開く
   - `/cancel-reservation?id=...` で確認画面を表示
   - キャンセルするか、変更ページに移動できる
5. 変更リンクを開く
   - `/edit-reservation?id=...` で現在の予約内容を自動入力
   - 内容を修正して更新できる

## 3) ファイル構成と役割

### 主要ページ

- `app/page.tsx`
  - 最初の入口ページ
  - LIFFログイン初期化を行い、予約ページへ誘導する

- `app/reserve/page.tsx`
  - 新規予約ページ
  - `formData`（入力データ）と `step`（現在のステップ）を管理する

- `app/edit-reservation/page.tsx`
  - 変更ページのラッパー
  - `Suspense` を使ってURLパラメータ読み込みを安全にする

- `app/edit-reservation/EditReservationPage.tsx`
  - 変更ページ本体
  - 予約IDで既存データを取得し、フォームに自動入力する

- `app/cancel-reservation/page.tsx`
  - キャンセルページのラッパー（`Suspense`）

- `app/cancel-reservation/CancelPage.tsx`
  - キャンセル確認画面
  - 「キャンセル」か「予約変更へ進む」を選べる

### フォーム関連コンポーネント

- `app/components/StepForm.tsx`
  - ステップ表示の切り替え担当
  - 車両 -> 日時 -> 住所 -> 確認 の順に表示する

- `app/components/CarOption.tsx`
  - メーカー・車種・サイズを入力する
  - DBの候補表示や手入力判定を行う

- `app/components/CalendarSelect.tsx`
  - 予約日と予約時間を入力する

- `app/components/AddressMap.tsx`
  - 住所入力と地図プレビューを表示する

- `app/components/PriceSummary.tsx`
  - 最終確認画面
  - 新規作成または更新を実行し、LINE通知を送る

- `app/components/LiffInit.tsx`
  - LIFF初期化専用コンポーネント
  - LINEプロフィールを取得して `localStorage` に保存する

### API・共通処理

- `app/lib/liff.ts`
  - LIFF初期化・プロフィール取得の共通関数

- `app/lib/supabase.ts`
  - Supabaseクライアント作成
  - 環境変数（URL/キー）を使って接続する

- `app/api/send-line/route.ts`
  - LINE Push APIへメッセージを送るサーバーAPI

- `app/api/cancel-reservation/route.ts`
  - 予約IDを受け取り、キャンセル状態へ更新するサーバーAPI

## 4) 環境変数（.env.local）

主に使っている変数:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_LIFF_ID`
- `NEXT_PUBLIC_BASE_URL`
- `LINE_CHANNEL_ACCESS_TOKEN`（サーバー側でのみ使用）

## 5) 初心者向けの注意ポイント

- 環境変数を変更したら、`pnpm dev` を再起動する
- `useSearchParams` を使うページは `Suspense` で包む
- Supabaseのカラム名とコード側の名前を一致させる
- `cars` の重複防止には `(maker, model)` の一意制約を維持する
