"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { menusToPriceMap, priceForOneCar } from "@/app/lib/menuPricing"
import { useAdminTenant } from "../adminTenantContext"
import { adminVehicleColorPlateLine } from "@/app/lib/vehicleDisplay"
import { maskNameForAdminDemo } from "../lib/demoDisplayMask"
import {
    googleMapsNavigationUrl,
    reservationStatusBadgeClass,
    reservationStatusLabelJa,
    RESERVATION_STATUS_OPTIONS,
} from "../lib/reservationStatus"

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
    sales_amount?: number | null
    interior?: boolean | null
    addon_slugs?: string[] | null
    vehicle_color_abbr?: string | null
    vehicle_plate?: string | null
}

function isConfirmedStatus(status: string | null | undefined): boolean {
    const s = (status || "confirmed").toLowerCase()
    return s === "confirmed"
}

function confirmedTargetIds(rows: Reservation[]): string[] {
    return rows.filter((r) => isConfirmedStatus(r.status)).map((r) => r.id)
}

type CompleteModalOpen = {
    anchorReservationId: string
    targetIds: string[]
    /** 各行の売上（保存済みはその値、未保存はメニューから算出） */
    salesAmountsById: Record<string, number>
    userName: string
    date: string
    time: string
    totalCount: number
}

function lineSalesForListRow(row: Reservation, menuPrices: Record<string, number>): number {
    const hasSaved = row.sales_amount !== null && row.sales_amount !== undefined
    if (hasSaved) return Number(row.sales_amount)
    return priceForOneCar(
        row.size,
        Array.isArray(row.addon_slugs) ? row.addon_slugs : row.interior ? ["interior_addon"] : [],
        menuPrices
    )
}

function buildSalesAmountsById(
    targetIds: string[],
    rows: Reservation[],
    menuPrices: Record<string, number>
): Record<string, number> {
    const out: Record<string, number> = {}
    for (const tid of targetIds) {
        const row = rows.find((r) => r.id === tid)
        if (row) out[tid] = lineSalesForListRow(row, menuPrices)
    }
    return out
}

export default function AdminReservationsPage() {
    const { tenantId, ready } = useAdminTenant()
    const [items, setItems] = useState<Reservation[]>([])
    const [loading, setLoading] = useState(true)
    const [date, setDate] = useState("")
    const [status, setStatus] = useState("all")
    const [q, setQ] = useState("")
    const [completeModal, setCompleteModal] = useState<CompleteModalOpen | null>(null)
    const [completeSubmitting, setCompleteSubmitting] = useState(false)
    const [menuPrices, setMenuPrices] = useState<Record<string, number>>({
        size_s: 8000,
        size_m: 9000,
        size_l: 10000,
        interior_addon: 3000,
    })

    const fetchReservations = useCallback(async () => {
        if (!tenantId) return
        setLoading(true)
        const params = new URLSearchParams()
        params.set("tenantId", tenantId)
        if (date) params.set("date", date)
        if (status) params.set("status", status)
        if (q) params.set("q", q)

        const res = await fetch(`/api/admin/reservations?${params.toString()}`)
        const json = await res.json()
        setItems(Array.isArray(json?.data) ? json.data : [])
        setLoading(false)
    }, [tenantId, date, status, q])

    useEffect(() => {
        if (!ready || !tenantId) return
        void fetchReservations()
    }, [ready, tenantId, fetchReservations])

    useEffect(() => {
        if (!ready || !tenantId) return
        fetch(`/api/public/tenant-config?tenantId=${encodeURIComponent(tenantId)}`)
            .then((r) => r.json())
            .then((j) => {
                const m = menusToPriceMap(j?.menus || [])
                if (Object.keys(m).length > 0) setMenuPrices(m)
            })
            .catch(() => {})
    }, [ready, tenantId])

    useEffect(() => {
        if (!completeModal) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !completeSubmitting) setCompleteModal(null)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [completeModal, completeSubmitting])

    const grouped = useMemo(() => {
        // group_id があるものはまとめて表示、無いものは id をグループキーにする
        const map = new Map<string, Reservation[]>()
        for (const row of items) {
            const key = row.group_id || `single-${row.id}`
            const bucket = map.get(key) || []
            bucket.push(row)
            map.set(key, bucket)
        }
        return Array.from(map.entries()).map(([key, rows]) => ({
            key,
            rows,
            first: rows[0],
            count: rows.length,
        }))
    }, [items])

    const submitListComplete = async () => {
        if (!completeModal) return
        const { anchorReservationId, targetIds, salesAmountsById } = completeModal
        if (targetIds.length === 0) return
        setCompleteSubmitting(true)
        try {
            const payload: Record<string, unknown> = {
                status: "done",
                service_done_at: new Date().toISOString(),
                applyGroup: false,
                target_ids: targetIds,
            }
            if (targetIds.length > 1) {
                payload.sales_amounts_by_id = salesAmountsById
            } else {
                payload.sales_amount = salesAmountsById[targetIds[0]] ?? 0
            }

            const res = await fetch(`/api/admin/reservations/${anchorReservationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                alert(`更新に失敗しました: ${json?.error || "unknown error"}`)
                return
            }
            setCompleteModal(null)
            await fetchReservations()
        } finally {
            setCompleteSubmitting(false)
        }
    }

    const controlClass =
        "w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
    const labelClass = "mb-1 block text-sm font-medium text-slate-800"

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            {completeModal ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
                    role="presentation"
                    onClick={() => !completeSubmitting && setCompleteModal(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="admin-res-complete-title"
                        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="admin-res-complete-title" className="text-lg font-bold text-slate-900">
                            予約を完了にしますか？
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600">
                            {maskNameForAdminDemo(tenantId, completeModal.userName)} / {completeModal.date}{" "}
                            {completeModal.time}
                            <br />
                            {completeModal.totalCount > completeModal.targetIds.length ? (
                                <>
                                    {completeModal.totalCount}台の予約のうち、
                                    <span className="font-semibold text-slate-800">
                                        予定中の {completeModal.targetIds.length} 台
                                    </span>
                                    を完了（実施済み）にします。
                                </>
                            ) : (
                                <>
                                    {completeModal.targetIds.length}台を完了（実施済み）にします。
                                </>
                            )}
                            <span className="mt-2 block text-xs text-slate-500">
                                実施日時はこの操作した時刻で記録されます。売上額は店舗メニュー料金から自動で入ります（すでに入力済みの行はそのまま）。メモ・追加料金は変わりません。
                            </span>
                            {completeModal.targetIds.length > 0 ? (
                                <p className="mt-2 text-sm font-semibold text-slate-800">
                                    記録する売上合計: ¥
                                    {completeModal.targetIds
                                        .reduce((sum, tid) => sum + (completeModal.salesAmountsById[tid] ?? 0), 0)
                                        .toLocaleString()}
                                </p>
                            ) : null}
                        </p>
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                disabled={completeSubmitting}
                                onClick={() => setCompleteModal(null)}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                disabled={completeSubmitting}
                                onClick={() => void submitListComplete()}
                                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {completeSubmitting ? "処理中…" : "完了にする"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">予約管理</h1>
                    <Link href="/admin" className="text-sm font-medium text-indigo-700 hover:underline">
                        管理トップへ戻る
                    </Link>
                </div>

                <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-900">検索条件</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                            <label className={labelClass} htmlFor="admin-res-date">
                                予約日
                            </label>
                            <input
                                id="admin-res-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className={controlClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass} htmlFor="admin-res-status">
                                ステータス
                            </label>
                            <select
                                id="admin-res-status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className={controlClass}
                            >
                                <option value="all">すべて</option>
                                {RESERVATION_STATUS_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-2">
                            <label className={labelClass} htmlFor="admin-res-q">
                                キーワード
                            </label>
                            <input
                                id="admin-res-q"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="名前・住所・車種で検索"
                                className={controlClass}
                            />
                        </div>
                    </div>
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={fetchReservations}
                            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                            条件で再検索
                        </button>
                    </div>
                </div>

                {loading ? (
                    <p className="text-slate-700">読み込み中...</p>
                ) : grouped.length === 0 ? (
                    <p className="text-slate-700">予約がありません</p>
                ) : (
                    <div className="space-y-3">
                        {grouped.map((g) => {
                            const addr = (g.first.address || "").trim()
                            const navHref = addr ? googleMapsNavigationUrl(addr) : null
                            const vehicleLines = g.rows
                                .map((r) => adminVehicleColorPlateLine(r.vehicle_color_abbr, r.vehicle_plate))
                                .filter((x): x is string => typeof x === "string" && x.length > 0)
                            const toCompleteIds = confirmedTargetIds(g.rows)
                            const showCompleteButton = toCompleteIds.length > 0
                            return (
                            <div key={g.key} className="rounded-xl border border-slate-200 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-slate-900">
                                            {maskNameForAdminDemo(tenantId, g.first.user_name)} / {g.first.date}{" "}
                                            {g.first.time}
                                        </p>
                                        <p className="text-sm text-slate-800">
                                            {g.count}台 / {g.first.address || "住所なし"}
                                        </p>
                                        {vehicleLines.length > 0 && (
                                            <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                                                {vehicleLines.map((line, i) => (
                                                    <li key={i}>{line}</li>
                                                ))}
                                            </ul>
                                        )}
                                        <p className="text-xs text-slate-600">
                                            group_id: {g.first.group_id || "-"}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${reservationStatusBadgeClass(g.first.status)}`}
                                        >
                                            {reservationStatusLabelJa(g.first.status)}
                                        </span>
                                        {navHref ? (
                                            <a
                                                href={navHref}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded-lg border border-emerald-600 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                                            >
                                                ナビ開始
                                            </a>
                                        ) : (
                                            <span
                                                className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-400"
                                                title="住所が登録されていないためナビを開けません"
                                            >
                                                ナビ（住所なし）
                                            </span>
                                        )}
                                        {showCompleteButton ? (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setCompleteModal({
                                                        anchorReservationId: toCompleteIds[0],
                                                        targetIds: toCompleteIds,
                                                        salesAmountsById: buildSalesAmountsById(
                                                            toCompleteIds,
                                                            g.rows,
                                                            menuPrices
                                                        ),
                                                        userName: g.first.user_name || "",
                                                        date: g.first.date || "",
                                                        time: g.first.time || "",
                                                        totalCount: g.rows.length,
                                                    })
                                                }
                                                className="rounded-lg border border-emerald-700 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                                            >
                                                完了
                                            </button>
                                        ) : null}
                                        <Link
                                            href={`/admin/reservations/${g.first.id}`}
                                            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                                        >
                                            詳細
                                        </Link>
                                    </div>
                                </div>
                            </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
