"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAdminTenant } from "../adminTenantContext"
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
}

export default function AdminReservationsPage() {
    const { tenantId, ready } = useAdminTenant()
    const [items, setItems] = useState<Reservation[]>([])
    const [loading, setLoading] = useState(true)
    const [date, setDate] = useState("")
    const [status, setStatus] = useState("all")
    const [q, setQ] = useState("")

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

    const controlClass =
        "w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
    const labelClass = "mb-1 block text-sm font-medium text-slate-800"

    return (
        <div className="min-h-screen bg-slate-50 p-4">
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
                            return (
                            <div key={g.key} className="rounded-xl border border-slate-200 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-slate-900">
                                            {g.first.user_name || "名前未登録"} / {g.first.date} {g.first.time}
                                        </p>
                                        <p className="text-sm text-slate-800">
                                            {g.count}台 / {g.first.address || "住所なし"}
                                        </p>
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
