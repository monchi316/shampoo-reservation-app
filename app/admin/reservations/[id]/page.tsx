"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type Reservation = {
    id: string
    group_id?: string | null
    user_name?: string | null
    maker?: string | null
    model?: string | null
    size?: string | null
    date?: string | null
    time?: string | null
    address?: string | null
    status?: string | null
    service_done_at?: string | null
    sales_amount?: number | null
    extra_fee?: number | null
    memo?: string | null
    staff_name?: string | null
    interior?: boolean | null
}

function calcDefaultSalesForRows(targetRows: Reservation[]) {
    const getBase = (size?: string | null) =>
        size === "S" ? 3000 : size === "M" ? 5000 : size === "L" ? 7000 : 0
    return targetRows.reduce((sum, r) => {
        const base = getBase(r.size)
        return sum + (r.interior ? base + 2000 : base)
    }, 0)
}

/** 1台分の基本売上（DBにあればその値、なければサイズ・内装から算出） */
function lineSalesForRow(row: Reservation): number {
    const hasSaved = row.sales_amount !== null && row.sales_amount !== undefined
    if (hasSaved) return Number(row.sales_amount)
    return calcDefaultSalesForRows([row])
}

export default function AdminReservationDetailPage() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const id = params.id

    const [base, setBase] = useState<Reservation | null>(null)
    const [rows, setRows] = useState<Reservation[]>([])
    const [loading, setLoading] = useState(true)
    const [applyGroup, setApplyGroup] = useState(true)
    /** applyGroup が false のとき、更新対象に含める予約行 id（チェックされた車両） */
    const [selectedRowIds, setSelectedRowIds] = useState<string[]>([])
    const [nextStatus, setNextStatus] = useState("confirmed")
    const [serviceDoneAt, setServiceDoneAt] = useState("")
    const [salesAmount, setSalesAmount] = useState("")
    const [extraFee, setExtraFee] = useState("")
    const [memo, setMemo] = useState("")
    const [staffName, setStaffName] = useState("")
    /** DB未保存で予約データから補完した値（視認性の高い文字色＋軽いハイライト） */
    const [serviceDoneAtIsSuggested, setServiceDoneAtIsSuggested] = useState(false)
    const [salesAmountIsSuggested, setSalesAmountIsSuggested] = useState(false)

    /** フォーム表示の基準にしている「一覧順で最初の選択車」が変わったときだけ hydrate する */
    const formAnchorRowIdRef = useRef<string | null>(null)

    const hydrateFromRow = useCallback((row: Reservation) => {
        setNextStatus(row.status || "confirmed")
        const fallbackDoneAt =
            row.date && row.time ? `${row.date}T${String(row.time).slice(0, 5)}` : ""
        const hasSavedServiceDoneAt =
            row.service_done_at !== null &&
            row.service_done_at !== undefined &&
            String(row.service_done_at) !== ""
        setServiceDoneAt(hasSavedServiceDoneAt ? String(row.service_done_at) : fallbackDoneAt)
        setServiceDoneAtIsSuggested(!hasSavedServiceDoneAt && Boolean(fallbackDoneAt))

        setExtraFee(row.extra_fee !== null && row.extra_fee !== undefined ? String(row.extra_fee) : "")
        setMemo(row.memo || "")
        setStaffName(row.staff_name || "")
    }, [])

    /** 基本売上の表示はこの effect に集約（複数台かつ部分選択時は選択台の合計） */
    useEffect(() => {
        if (loading || rows.length === 0) return

        if (rows.length === 1) {
            const r = rows[0]
            const def = calcDefaultSalesForRows([r])
            const hasSaved = r.sales_amount !== null && r.sales_amount !== undefined
            setSalesAmount(hasSaved ? String(r.sales_amount) : def > 0 ? String(def) : "")
            setSalesAmountIsSuggested(!hasSaved && def > 0)
            return
        }

        if (applyGroup) {
            const r = rows[0]
            const def = calcDefaultSalesForRows([r])
            const hasSaved = r.sales_amount !== null && r.sales_amount !== undefined
            setSalesAmount(hasSaved ? String(r.sales_amount) : def > 0 ? String(def) : "")
            setSalesAmountIsSuggested(!hasSaved && def > 0)
            return
        }

        const sel = rows.filter((r) => selectedRowIds.includes(r.id))
        if (sel.length === 0) return

        if (sel.length === 1) {
            const r = sel[0]
            const def = calcDefaultSalesForRows([r])
            const hasSaved = r.sales_amount !== null && r.sales_amount !== undefined
            setSalesAmount(hasSaved ? String(r.sales_amount) : def > 0 ? String(def) : "")
            setSalesAmountIsSuggested(!hasSaved && def > 0)
            return
        }

        const sum = sel.reduce((acc, r) => acc + lineSalesForRow(r), 0)
        setSalesAmount(sum > 0 ? String(sum) : "")
        setSalesAmountIsSuggested(sel.some((r) => r.sales_amount == null || r.sales_amount === undefined))
    }, [loading, rows, applyGroup, selectedRowIds])

    const fetchDetail = async () => {
        setLoading(true)
        const res = await fetch(`/api/admin/reservations/${id}`)
        const json = await res.json()
        if (!res.ok) {
            setLoading(false)
            return
        }
        setBase(json.data || null)
        const groupRows: Reservation[] = Array.isArray(json.groupRows) ? json.groupRows : []
        setRows(groupRows)

        const allIds = groupRows.map((r) => r.id)
        const mergedIds =
            selectedRowIds.filter((x) => allIds.includes(x)).length > 0
                ? selectedRowIds.filter((x) => allIds.includes(x))
                : allIds
        setSelectedRowIds(mergedIds)
        const rowForForm =
            groupRows.find((r) => mergedIds.includes(r.id)) || (json.data as Reservation)
        hydrateFromRow(rowForForm)
        formAnchorRowIdRef.current = rowForForm.id

        setLoading(false)
    }

    useEffect(() => {
        fetchDetail()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- id 変更時のみ再取得。保存後の再読込は手動で fetchDetail を呼ぶ
    }, [id])

    /** 一覧順で「先頭の選択車」が変わったときだけフォームを差し替え（追加選択では入力中の値を維持） */
    useEffect(() => {
        if (loading || applyGroup || rows.length <= 1) return
        const first = rows.find((r) => selectedRowIds.includes(r.id))
        if (!first) {
            formAnchorRowIdRef.current = null
            return
        }
        if (formAnchorRowIdRef.current === first.id) return
        formAnchorRowIdRef.current = first.id
        hydrateFromRow(first)
    }, [selectedRowIds, applyGroup, rows, loading, hydrateFromRow])

    const mapUrl = useMemo(() => {
        const address = base?.address || ""
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    }, [base?.address])

    const toggleRowSelected = (rowId: string) => {
        setSelectedRowIds((prev) =>
            prev.includes(rowId) ? prev.filter((x) => x !== rowId) : [...prev, rowId]
        )
    }

    const updateStatus = async () => {
        if (!applyGroup && selectedRowIds.length === 0) {
            alert("更新対象の車両を1台以上選択してください。")
            return
        }

        const selectedRowsForPayload = rows.filter((r) => selectedRowIds.includes(r.id))
        const multiPartialSales =
            !applyGroup && rows.length > 1 && selectedRowsForPayload.length > 1

        const payload: Record<string, unknown> = {
            status: nextStatus,
            applyGroup,
            ...(!applyGroup && selectedRowIds.length > 0 ? { target_ids: selectedRowIds } : {}),
            service_done_at: serviceDoneAt || null,
            extra_fee: extraFee === "" ? null : Number(extraFee),
            memo: memo || null,
            staff_name: staffName || null,
        }
        if (multiPartialSales) {
            payload.sales_amounts_by_id = Object.fromEntries(
                selectedRowsForPayload.map((r) => [r.id, lineSalesForRow(r)])
            )
        } else {
            payload.sales_amount = salesAmount === "" ? null : Number(salesAmount)
        }

        const res = await fetch(`/api/admin/reservations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            alert(`更新失敗: ${json?.error || "unknown error"}`)
            return
        }
        alert("ステータスを更新しました")
        fetchDetail()
    }

    if (loading) {
        return <div className="p-6 text-slate-800">読み込み中...</div>
    }

    const inputReadable =
        "w-full rounded-lg border p-2.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
    const inputSuggested = (isSuggested: boolean) =>
        isSuggested
            ? " border-amber-300 bg-amber-50/80 ring-1 ring-amber-200/90"
            : " border-slate-300 bg-white"

    if (!base) {
        return (
            <div className="p-6">
                <p className="mb-4 text-slate-700">予約が見つかりません</p>
                <Link href="/admin/reservations" className="text-indigo-600 hover:underline">
                    一覧へ戻る
                </Link>
            </div>
        )
    }

    const firstSelectedRow = rows.find((r) => selectedRowIds.includes(r.id))
    const selectedLabels = rows
        .filter((r) => selectedRowIds.includes(r.id))
        .map((r) => `${r.maker} ${r.model}（${r.size}）`)

    const multiPartialSales =
        !applyGroup && rows.length > 1 && selectedRowIds.length > 1

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-2xl font-bold text-slate-900">予約詳細</h1>
                    <div className="flex items-center gap-3">
                        <Link href="/admin/reservations" className="text-sm font-medium text-indigo-700 hover:underline">
                            一覧へ戻る
                        </Link>
                        <button
                            type="button"
                            onClick={() => router.refresh()}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                        >
                            再読込
                        </button>
                    </div>
                </div>

                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-800">お客様</p>
                    <p className="font-semibold text-slate-900">{base.user_name || "名前未登録"}</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">日時</p>
                    <p className="font-medium text-slate-900">{base.date} {base.time}</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">住所</p>
                    <p className="font-medium text-slate-900">{base.address}</p>
                    <a
                        href={mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm font-semibold text-indigo-700 hover:underline"
                    >
                        Googleマップでナビ開始
                    </a>
                </div>

                <div className="mb-4 rounded-xl border border-slate-200 p-4">
                    <p className="mb-2 font-semibold text-slate-900">車両一覧（同一予約グループ）</p>
                    {!applyGroup && rows.length > 1 && (
                        <p className="mb-2 text-sm font-medium text-slate-800">
                            「全体に適用」をオフにしたときは、更新する車両にチェックを入れてください（複数台をまとめて選択できます）。
                        </p>
                    )}
                    {!applyGroup && rows.length > 1 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const all = rows.map((r) => r.id)
                                    setSelectedRowIds(all)
                                    const first = rows[0]
                                    if (first) {
                                        hydrateFromRow(first)
                                        formAnchorRowIdRef.current = first.id
                                    }
                                }}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                            >
                                全て選択
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedRowIds([])
                                    formAnchorRowIdRef.current = null
                                }}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                            >
                                全て解除
                            </button>
                        </div>
                    )}
                    <div className="space-y-2">
                        {rows.map((row, idx) => (
                            <div
                                key={row.id}
                                className={`flex items-start gap-3 rounded-lg border p-2.5 text-sm ${
                                    !applyGroup && selectedRowIds.includes(row.id)
                                        ? "border-indigo-200 bg-indigo-50/50"
                                        : "border-transparent bg-slate-50/80"
                                }`}
                            >
                                {!applyGroup && rows.length > 1 ? (
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 size-4 shrink-0 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
                                        checked={selectedRowIds.includes(row.id)}
                                        onChange={() => toggleRowSelected(row.id)}
                                        aria-label={`${row.maker} ${row.model} を更新対象に含める`}
                                    />
                                ) : (
                                    <span className="w-4 shrink-0" aria-hidden />
                                )}
                                <span className="flex flex-1 flex-wrap items-baseline justify-between gap-2 font-medium text-slate-900">
                                    <span>
                                        {idx + 1}. {row.maker} {row.model}（{row.size}）
                                    </span>
                                    {rows.length > 1 && (
                                        <span className="text-sm font-semibold text-slate-800">
                                            ¥{lineSalesForRow(row).toLocaleString()}
                                            <span className="ml-1 text-xs font-normal text-slate-600">
                                                {row.sales_amount != null && row.sales_amount !== undefined
                                                    ? "保存値"
                                                    : "見積"}
                                            </span>
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-600">group_id: {base.group_id || "-"}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <p className="mb-3 font-semibold text-slate-900">ステータス更新</p>
                    <div className="mb-3 flex flex-wrap items-end gap-3">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-800" htmlFor="admin-detail-status">
                                次のステータス
                            </label>
                            <select
                                id="admin-detail-status"
                                value={nextStatus}
                                onChange={(e) => setNextStatus(e.target.value)}
                                className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            >
                                <option value="confirmed">confirmed</option>
                                <option value="done">done</option>
                                <option value="cancelled">cancelled</option>
                            </select>
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 pb-2.5 text-sm font-medium text-slate-900">
                            <input
                                type="checkbox"
                                className="size-4 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
                                checked={applyGroup}
                                onChange={(e) => {
                                    const checked = e.target.checked
                                    setApplyGroup(checked)
                                    if (!checked && rows.length > 0) {
                                        const all = rows.map((r) => r.id)
                                        setSelectedRowIds(all)
                                        hydrateFromRow(rows[0])
                                        formAnchorRowIdRef.current = rows[0].id
                                    }
                                }}
                            />
                            同じ group_id 全体に適用
                        </label>
                    </div>
                    {!applyGroup && rows.length > 1 && (
                        <p className="mb-3 text-sm font-medium text-slate-800">
                            選択中: {selectedRowIds.length}台
                            {selectedLabels.length > 0
                                ? `（${selectedLabels.join("、")}）`
                                : "（未選択のため保存できません）"}
                        </p>
                    )}
                    {!applyGroup && rows.length === 1 && (
                        <p className="mb-3 text-xs font-medium text-slate-700">
                            このグループは1台のみです。下記の内容はこの予約行に保存されます。
                        </p>
                    )}
                    {applyGroup && rows.length > 1 && (
                        <p className="mb-3 text-xs font-medium text-slate-700">
                            チェック中は、同じ group_id の全車両の予約行に同じ内容で保存されます。
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={updateStatus}
                        className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700"
                    >
                        ステータスを更新する
                    </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                    <p className="mb-3 font-semibold text-slate-900">サービス実施入力 / 売上入力</p>
                    {!applyGroup && rows.length > 1 && (
                        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm font-medium text-slate-900">
                            実施日時・追加料金・メモ・担当者は、チェックした
                            {selectedRowIds.length > 0 ? `${selectedRowIds.length}台すべて` : "…"}
                            に同じ内容で保存されます。
                            {multiPartialSales ? (
                                <span className="block mt-1 text-xs font-normal text-slate-800">
                                    基本売上は、各車の単価（一覧の「保存値」または「見積」）を足した合計を表示しています。保存時は
                                    <strong className="font-semibold"> 車ごとに正しい金額 </strong>
                                    が書き込まれます。
                                </span>
                            ) : (
                                firstSelectedRow && (
                                    <span className="block mt-1 text-xs font-normal text-slate-800">
                                        基本売上はこの1台分です（必要なら金額を編集してから保存してください）。
                                    </span>
                                )
                            )}
                        </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-800">実施日時</label>
                            <input
                                type="datetime-local"
                                value={serviceDoneAt}
                                onChange={(e) => {
                                    setServiceDoneAt(e.target.value)
                                    setServiceDoneAtIsSuggested(false)
                                }}
                                className={`${inputReadable} ${inputSuggested(serviceDoneAtIsSuggested)}`}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-800">
                                基本売上（円）
                                {multiPartialSales && (
                                    <span className="ml-1 text-xs font-normal text-slate-600">
                                        ＝選択車の合計（参照のみ）
                                    </span>
                                )}
                            </label>
                            <input
                                type="number"
                                readOnly={multiPartialSales}
                                value={salesAmount}
                                onChange={(e) => {
                                    setSalesAmount(e.target.value)
                                    setSalesAmountIsSuggested(false)
                                }}
                                className={`${inputReadable} ${inputSuggested(salesAmountIsSuggested)} ${
                                    multiPartialSales ? "cursor-not-allowed bg-slate-100" : ""
                                }`}
                            />
                            {multiPartialSales && (
                                <p className="mt-1 text-xs font-medium text-slate-700">
                                    金額は車両一覧の各行で確認できます。チェックを変えると合計が再計算されます。
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-800">追加料金（円）</label>
                            <input
                                type="number"
                                value={extraFee}
                                onChange={(e) => setExtraFee(e.target.value)}
                                className={`${inputReadable} border-slate-300 bg-white`}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-slate-800">担当者名</label>
                            <input
                                value={staffName}
                                onChange={(e) => setStaffName(e.target.value)}
                                className={`${inputReadable} border-slate-300 bg-white`}
                                placeholder="例: 山田"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-slate-800">メモ</label>
                            <textarea
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                rows={3}
                                className={`${inputReadable} border-slate-300 bg-white`}
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={updateStatus}
                        className="mt-3 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700"
                    >
                        実施/売上情報を保存する
                    </button>
                </div>
            </div>
        </div>
    )
}
