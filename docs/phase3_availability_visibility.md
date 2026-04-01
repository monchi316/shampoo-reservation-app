# Phase 3: 予約状況の可視化（日時候補表示）

## 要約（先に結論）

- 予約画面の「日時選択」で、**選択した日付に対する予約可能時刻候補**を表示します。
- 候補はサーバー側で、既存予約・移動時間・営業時間・台数を加味して計算します。
- ユーザーは候補ボタンを押すだけで時刻入力でき、予約が取りやすくなります。
- 最終登録前には従来どおり `POST /api/public/availability-check` で再チェックします。

---

## 背景（なぜ必要か）

これまでは、ユーザーが日時を手入力し、次へ進むときに可否判定していました。  
そのため「どの時間なら取れるか」が分からず、何度も入力し直しが必要でした。

---

## 実装予定（事前設計）

1. **API拡張**
   - `GET /api/public/availability-check?date=...&numCars=...&tenantId=...`
   - 指定日の「予約可能開始時刻一覧」を返す。

2. **サーバー計算ロジック追加**
   - `loadSchedulingBundle` / `loadExistingReservationSlots` を流用し、30分刻みで候補生成。
   - 予約変更時は `excludeGroupId` / `excludeReservationIds` を反映。

3. **予約UIの改善**
   - `CalendarSelect` に候補一覧表示を追加。
   - 候補ボタン押下で `time` 入力に反映。

---

## 実装内容（実際にやったこと）

### 1) サーバー側: 候補時刻を返す機能

- `app/lib/serverTenantData.ts`
  - `listAvailableStartTimes(...)` を追加。
  - 営業枠の開始〜終了を30分刻みで走査し、`canBookSlot(...)` が `ok` の時刻のみ採用。

- `app/api/public/availability-check/route.ts`
  - `GET` を追加（従来の `POST` は維持）。
  - パラメータ:
    - `date`（必須）
    - `numCars`（必須）
    - `tenantId`（任意、未指定はデフォルト）
    - `excludeGroupId`（更新時）
    - `excludeReservationIds`（更新時、カンマ区切り）

### 2) フロント側: 日時候補の可視化

- `app/components/CalendarSelect.tsx`
  - 日付・台数・tenant が揃うと `GET /api/public/availability-check` を呼び出し。
  - 候補時刻をチップ（ボタン）表示。
  - チップを押すと `formData.time` に反映。
  - 読み込み中/候補なし/エラー表示を追加。

---

## 仕様メモ

- 候補表示は「入力補助」です。  
  予約確定前に **必ず再判定**（競合や直前変更を考慮）するため、整合は従来どおり保たれます。

- 刻み幅は現在 **30分**。必要なら後で設定化できます。

---

## 確認手順

1. 予約画面で車両入力（1台以上）を完了し、日時ステップへ進む  
2. 日付を選択すると「この日の空き時間候補」が表示される  
3. 候補を押すと time に反映される  
4. 候補時刻で次へ進める  
5. 候補外の時刻を手入力した場合は、従来どおりエラー表示される

