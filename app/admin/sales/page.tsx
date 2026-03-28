"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

type DailyRow = {
    date: string
    count: number
    sales_total: number
    extra_total: number
    grand_total: number
}

type MonthlyRow = {
    month: string
    count: number
    sales_total: number
    extra_total: number
    grand_total: number
}

type SalesRow = {
    id: string
    date: string | null
    user_name: string | null
    maker: string | null
    model: string | null
    size: string | null
    sales_amount: number | null
    extra_fee: number | null
    service_done_at: string | null
    staff_name: string | null
}

export default function AdminSalesPage() {
    const [from, setFrom] = useState("")
    const [to, setTo] = useState("")
    const [loading, setLoading] = useState(true)
    const [daily, setDaily] = useState<DailyRow[]>([])
    const [monthly, setMonthly] = useState<MonthlyRow[]>([])
    const [byStaff, setByStaff] = useState<
        { staff_name: string; count: number; sales_total: number; extra_total: number; grand_total: number }[]
    >([])
    const [rows, setRows] = useState<SalesRow[]>([])

    const fetchData = async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (from) params.set("from", from)
        if (to) params.set("to", to)
        const res = await fetch(`/api/admin/sales?${params.toString()}`)
        const json = await res.json()
        setDaily(Array.isArray(json?.daily) ? json.daily : [])
        setMonthly(Array.isArray(json?.monthly) ? json.monthly : [])
        setByStaff(Array.isArray(json?.byStaff) ? json.byStaff : [])
        setRows(Array.isArray(json?.rows) ? json.rows : [])
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const totals = useMemo(() => {
        return daily.reduce(
            (acc, d) => {
                acc.count += d.count
                acc.sales += Number(d.sales_total || 0)
                acc.extra += Number(d.extra_total || 0)
                acc.grand += Number(d.grand_total || 0)
                return acc
            },
            { count: 0, sales: 0, extra: 0, grand: 0 }
        )
    }, [daily])

    const controlClass =
        "w-full rounded-lg border border-slate-300 bg-white p-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
    const labelClass = "mb-1 block text-sm font-medium text-slate-800"
    const thClass = "px-3 py-2.5 text-left text-sm font-semibold text-slate-900"
    const tdClass = "px-3 py-2.5 text-sm text-slate-900"

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">売上管理</h1>
                    <div className="flex items-center gap-3">
                        <a
                            href={`/api/admin/sales?${new URLSearchParams(
                                Object.fromEntries(
                                    Object.entries({ from, to }).filter(([, v]) => !!v)
                                )
                            ).toString()}&format=csv`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                        >
                            CSVダウンロード
                        </a>
                        <Link href="/admin" className="text-sm font-medium text-indigo-700 hover:underline">
                            管理トップへ戻る
                        </Link>
                    </div>
                </div>

                <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-900">集計期間</p>
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
                            <label className={labelClass} htmlFor="admin-sales-from">
                                開始日
                            </label>
                            <input
                                id="admin-sales-from"
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className={controlClass}
                            />
                        </div>
                        <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
                            <label className={labelClass} htmlFor="admin-sales-to">
                                終了日
                            </label>
                            <input
                                id="admin-sales-to"
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className={controlClass}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={fetchData}
                            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                            集計更新
                        </button>
                    </div>
                </div>

                <div className="mb-5 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-800">件数</p>
                        <p className="text-xl font-bold text-slate-900">{totals.count}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-800">基本売上</p>
                        <p className="text-xl font-bold text-slate-900">¥{totals.sales.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-800">追加料金</p>
                        <p className="text-xl font-bold text-slate-900">¥{totals.extra.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-sm font-medium text-emerald-900">合計</p>
                        <p className="text-xl font-bold text-emerald-900">¥{totals.grand.toLocaleString()}</p>
                    </div>
                </div>

                {loading ? (
                    <p className="text-slate-800">読み込み中...</p>
                ) : (
                    <>
                        <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200">
                            <p className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
                                日付別売上
                            </p>
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-100 text-left">
                                    <tr>
                                        <th className={thClass}>日付</th>
                                        <th className={thClass}>件数</th>
                                        <th className={thClass}>基本売上</th>
                                        <th className={thClass}>追加料金</th>
                                        <th className={thClass}>合計</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {daily.map((d) => (
                                        <tr key={d.date} className="border-t border-slate-200 bg-white">
                                            <td className={tdClass}>{d.date}</td>
                                            <td className={tdClass}>{d.count}</td>
                                            <td className={tdClass}>¥{d.sales_total.toLocaleString()}</td>
                                            <td className={tdClass}>¥{d.extra_total.toLocaleString()}</td>
                                            <td className={`${tdClass} font-semibold`}>¥{d.grand_total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mb-6 rounded-xl border border-slate-200 p-4">
                            <p className="mb-3 font-semibold text-slate-900">月次売上グラフ（合計）</p>
                            <div className="space-y-2">
                                {monthly.length === 0 && (
                                    <p className="text-sm font-medium text-slate-800">データがありません</p>
                                )}
                                {monthly.map((m) => {
                                    const max = Math.max(...monthly.map((x) => x.grand_total), 1)
                                    const width = Math.round((m.grand_total / max) * 100)
                                    return (
                                        <div key={m.month} className="grid grid-cols-[90px_1fr_110px] items-center gap-2 text-sm">
                                            <span className="font-medium text-slate-900">{m.month}</span>
                                            <div className="h-3 rounded bg-slate-100">
                                                <div
                                                    className="h-3 rounded bg-indigo-500"
                                                    style={{ width: `${width}%` }}
                                                />
                                            </div>
                                            <span className="text-right font-semibold text-slate-900">
                                                ¥{m.grand_total.toLocaleString()}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200">
                            <p className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
                                担当者別売上
                            </p>
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-100 text-left">
                                    <tr>
                                        <th className={thClass}>担当者</th>
                                        <th className={thClass}>件数</th>
                                        <th className={thClass}>基本売上</th>
                                        <th className={thClass}>追加料金</th>
                                        <th className={thClass}>合計</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {byStaff.map((s) => (
                                        <tr key={s.staff_name} className="border-t border-slate-200 bg-white">
                                            <td className={`${tdClass} font-medium`}>{s.staff_name}</td>
                                            <td className={tdClass}>{s.count}</td>
                                            <td className={tdClass}>¥{s.sales_total.toLocaleString()}</td>
                                            <td className={tdClass}>¥{s.extra_total.toLocaleString()}</td>
                                            <td className={`${tdClass} font-semibold`}>¥{s.grand_total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <p className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">
                                実施明細（実施日時・担当者）
                            </p>
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-100 text-left">
                                    <tr>
                                        <th className={thClass}>実施日時</th>
                                        <th className={thClass}>顧客名</th>
                                        <th className={thClass}>担当者</th>
                                        <th className={thClass}>車両</th>
                                        <th className={thClass}>基本売上</th>
                                        <th className={thClass}>追加料金</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.id} className="border-t border-slate-200 bg-white">
                                            <td className={`${tdClass} font-medium`}>{r.service_done_at || "-"}</td>
                                            <td className={tdClass}>{r.user_name || "-"}</td>
                                            <td className={`${tdClass} font-medium`}>{r.staff_name || "未設定"}</td>
                                            <td className={tdClass}>
                                                {r.maker} {r.model}（{r.size}）
                                            </td>
                                            <td className={tdClass}>¥{Number(r.sales_amount || 0).toLocaleString()}</td>
                                            <td className={tdClass}>¥{Number(r.extra_fee || 0).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
