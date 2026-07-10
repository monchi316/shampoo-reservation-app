"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAdminTenant } from "../adminTenantContext"
import { lineAdminNotifyUserIdsToText, parseLineAdminNotifyUserIds } from "@/app/lib/lineAdminNotify"

function adminTenantQs(tenantId: string | null) {
    if (!tenantId) return ""
    return `?tenantId=${encodeURIComponent(tenantId)}`
}

type MenuRow = {
    id: string
    slug: string
    label: string
    price: number
    sort_order: number
    active: boolean
}

type WeeklyRow = {
    day_of_week: number
    is_closed: boolean
    open_time: string | null
    close_time: string | null
}

type ExceptionRow = {
    exception_date: string
    is_closed: boolean
    open_time: string | null
    close_time: string | null
}

const DOW_JA = ["日", "月", "火", "水", "木", "金", "土"]

/** 予約画面の料金計算と対応する行（この順で一覧の上に並べる） */
const CORE_MENU_SLUGS = ["size_s", "size_m", "size_l", "interior_addon"] as const

const SLUG_ROLE_LABEL: Record<string, string> = {
    size_s: "車両サイズ S",
    size_m: "車両サイズ M",
    size_l: "車両サイズ L",
    interior_addon: "内装清掃オプション",
}

function sortMenusForDisplay(rows: MenuRow[]): MenuRow[] {
    const coreIndex = (slug: string) =>
        CORE_MENU_SLUGS.indexOf(slug as (typeof CORE_MENU_SLUGS)[number])

    return [...rows].sort((a, b) => {
        const ia = coreIndex(a.slug)
        const ib = coreIndex(b.slug)
        const aCore = ia >= 0
        const bCore = ib >= 0
        if (aCore && bCore) return ia - ib
        if (aCore) return -1
        if (bCore) return 1
        return a.sort_order - b.sort_order || a.slug.localeCompare(b.slug)
    })
}

export default function AdminSettingsPage() {
    const { tenantId, ready, canManageSettings, operatorRole } = useAdminTenant()
    const [menus, setMenus] = useState<MenuRow[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState("")

    const [mode, setMode] = useState<"uniform" | "weekly">("uniform")
    const [uniformOpen, setUniformOpen] = useState("09:00")
    const [uniformClose, setUniformClose] = useState("18:00")
    const [avgService, setAvgService] = useState(60)
    const [avgTravel, setAvgTravel] = useState(30)
    const [bookingLeadDays, setBookingLeadDays] = useState(0)
    const [bookingLeadHours, setBookingLeadHours] = useState(0)
    const [reminderEnabled, setReminderEnabled] = useState(true)
    const [reminderTemplate, setReminderTemplate] = useState("")
    const [weekly, setWeekly] = useState<WeeklyRow[]>([])
    const [exceptions, setExceptions] = useState<ExceptionRow[]>([])
    const [seeding, setSeeding] = useState(false)

    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [savingNotifications, setSavingNotifications] = useState(false)
    const [notificationFeedback, setNotificationFeedback] = useState<{
        kind: "ok" | "err"
        text: string
    } | null>(null)
    const [completeLineTemplate, setCompleteLineTemplate] = useState("")
    const [changeLineTemplate, setChangeLineTemplate] = useState("")
    const [cancelLineTemplate, setCancelLineTemplate] = useState("")
    const [adminNotifyLineIdsText, setAdminNotifyLineIdsText] = useState("")
    const [featureVehicleColorPlate, setFeatureVehicleColorPlate] = useState(false)
    const [savingFeatures, setSavingFeatures] = useState(false)

    const loadMenus = useCallback(async () => {
        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/menus${adminTenantQs(tenantId)}`)
        const json = await res.json()
        if (res.ok) setMenus(json.data || [])
    }, [tenantId])

    const sortedMenus = useMemo(() => sortMenusForDisplay(menus), [menus])

    const loadScheduling = useCallback(async () => {
        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/scheduling${adminTenantQs(tenantId)}`)
        const json = await res.json()
        if (!res.ok) return
        const s = json.settings
        if (s) {
            setMode(s.business_hours_mode || "uniform")
            setUniformOpen((s.uniform_open || "09:00").slice(0, 5))
            setUniformClose((s.uniform_close || "18:00").slice(0, 5))
            setAvgService(s.avg_service_minutes_per_car ?? 60)
            setAvgTravel(s.avg_travel_minutes ?? 30)
            setBookingLeadDays(s.booking_lead_days ?? 0)
            setBookingLeadHours(s.booking_lead_hours ?? 0)
        }
        if (Array.isArray(json.weekly) && json.weekly.length > 0) {
            setWeekly(
                json.weekly.map(
                    (w: {
                        day_of_week: number
                        is_closed: boolean
                        open_time: unknown
                        close_time: unknown
                    }) => ({
                    day_of_week: w.day_of_week,
                    is_closed: w.is_closed,
                    open_time: w.open_time ? String(w.open_time).slice(0, 5) : null,
                    close_time: w.close_time ? String(w.close_time).slice(0, 5) : null,
                })
                )
            )
        } else {
            setWeekly(
                [0, 1, 2, 3, 4, 5, 6].map((d) => ({
                    day_of_week: d,
                    is_closed: d === 0,
                    open_time: d === 0 ? null : "09:00",
                    close_time: d === 0 ? null : "18:00",
                }))
            )
        }
        if (Array.isArray(json.exceptions)) {
            setExceptions(
                json.exceptions.map(
                    (e: {
                        exception_date: string
                        is_closed: boolean
                        open_time: unknown
                        close_time: unknown
                    }) => ({
                    exception_date: e.exception_date,
                    is_closed: e.is_closed,
                    open_time: e.open_time ? String(e.open_time).slice(0, 5) : null,
                    close_time: e.close_time ? String(e.close_time).slice(0, 5) : null,
                })
                )
            )
        }
    }, [tenantId])

    const loadNotificationMessages = useCallback(async () => {
        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/notification-messages${adminTenantQs(tenantId)}`, {
            credentials: "include",
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            const errText =
                typeof json?.error === "string"
                    ? json.error
                    : "通知文面の取得に失敗しました（DBに line_message_template_* 列があるか確認してください）"
            setNotificationFeedback({ kind: "err", text: errText })
            return
        }
        setNotificationFeedback((f) => (f?.kind === "err" ? null : f))
        setReminderEnabled(json.reminder_enabled !== false)
        setReminderTemplate(String(json.reminder_template || ""))
        setCompleteLineTemplate(String(json.line_message_template_reservation_complete || ""))
        setChangeLineTemplate(String(json.line_message_template_reservation_change || ""))
        setCancelLineTemplate(String(json.line_message_template_reservation_cancel || ""))
        setAdminNotifyLineIdsText(
            lineAdminNotifyUserIdsToText(parseLineAdminNotifyUserIds(json.line_admin_notify_user_ids))
        )
    }, [tenantId])

    const loadLogo = useCallback(async () => {
        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/logo${adminTenantQs(tenantId)}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return
        setLogoUrl((json?.logoUrl as string | null) || null)
    }, [tenantId])

    const loadFeatureFlags = useCallback(async () => {
        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/feature-flags${adminTenantQs(tenantId)}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return
        setFeatureVehicleColorPlate(json?.flags?.vehicle_color_plate === true)
    }, [tenantId])

    useEffect(() => {
        if (!ready) return
        if (!tenantId) {
            ;(async () => {
                setLoading(false)
            })()
            return
        }
        ;(async () => {
            setLoading(true)
            await Promise.all([
                loadMenus(),
                loadScheduling(),
                loadLogo(),
                loadNotificationMessages(),
                loadFeatureFlags(),
            ])
            setLoading(false)
        })()
    }, [ready, tenantId, loadMenus, loadScheduling, loadLogo, loadNotificationMessages, loadFeatureFlags])

    const uploadLogo = async () => {
        if (!logoFile) return
        setUploadingLogo(true)
        setMsg("")
        const fd = new FormData()
        fd.append("file", logoFile)

        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/logo${adminTenantQs(tenantId)}`, {
            method: "POST",
            body: fd,
        })
        const json = await res.json().catch(() => ({}))
        setUploadingLogo(false)
        if (!res.ok) {
            setMsg(`ロゴアップロード失敗: ${json?.error || ""}`)
            return
        }

        setLogoFile(null)
        setMsg("ロゴを保存しました")
        await loadLogo()
    }

    const deleteLogo = async () => {
        setUploadingLogo(true)
        setMsg("")
        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/logo${adminTenantQs(tenantId)}`, { method: "DELETE" })
        const json = await res.json().catch(() => ({}))
        setUploadingLogo(false)
        if (!res.ok) {
            setMsg(`ロゴ削除失敗: ${json?.error || ""}`)
            return
        }
        setMsg("ロゴを削除しました")
        await loadLogo()
    }

    const saveMenuRow = async (row: MenuRow, patch: Partial<MenuRow>) => {
        setMsg("")
        const res = await fetch(`/api/admin/tenant/menus/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            setMsg(`メニュー更新失敗: ${json?.error || ""}`)
            return
        }
        setMsg("メニューを保存しました")
        loadMenus()
    }

    const addMenu = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const label = String(fd.get("label") || "").trim()
        const price = Number(fd.get("price"))
        if (!label) return
        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/menus${adminTenantQs(tenantId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label, price, sort_order: 100 }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            alert(json?.error || "追加失敗")
            return
        }
        ;(e.target as HTMLFormElement).reset()
        loadMenus()
    }

    const seedDefaultMenus = async () => {
        setSeeding(true)
        setMsg("")
        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/menus/seed${adminTenantQs(tenantId)}`, {
            method: "POST",
        })
        const json = await res.json().catch(() => ({}))
        setSeeding(false)
        if (!res.ok) {
            setMsg(`標準メニュー投入に失敗: ${json?.error || ""}`)
            return
        }
        setMsg(json.inserted > 0 ? `標準メニューを ${json.inserted} 件登録しました` : json.message || "完了")
        loadMenus()
    }

    const saveScheduling = async () => {
        if (!tenantId) {
            setMsg("店舗が選択されていません")
            return
        }
        setSaving(true)
        setMsg("")
        const res = await fetch(`/api/admin/tenant/scheduling${adminTenantQs(tenantId)}`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                business_hours_mode: mode,
                uniform_open: uniformOpen,
                uniform_close: uniformClose,
                avg_service_minutes_per_car: avgService,
                avg_travel_minutes: avgTravel,
                booking_lead_days: bookingLeadDays,
                booking_lead_hours: bookingLeadHours,
                weekly,
                exceptions,
            }),
        })
        const json = await res.json().catch(() => ({}))
        setSaving(false)
        if (!res.ok) {
            setMsg(`保存失敗: ${json?.error || ""}`)
            return
        }
        setMsg("営業・予約設定を保存しました")
        loadScheduling()
    }

    const saveNotificationMessages = async () => {
        if (!tenantId) {
            const t = "店舗が選択されていません"
            setMsg(t)
            setNotificationFeedback({ kind: "err", text: t })
            return
        }
        setSavingNotifications(true)
        setMsg("")
        setNotificationFeedback(null)
        try {
            const res = await fetch(`/api/admin/tenant/notification-messages${adminTenantQs(tenantId)}`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reminder_enabled: reminderEnabled,
                    reminder_template: reminderTemplate,
                    line_message_template_reservation_complete: completeLineTemplate,
                    line_message_template_reservation_change: changeLineTemplate,
                    line_message_template_reservation_cancel: cancelLineTemplate,
                    line_admin_notify_user_ids: parseLineAdminNotifyUserIds(adminNotifyLineIdsText),
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                const detail =
                    typeof json?.error === "string" && json.error
                        ? json.error
                        : `HTTP ${res.status}`
                const line = `保存に失敗しました: ${detail}`
                setMsg(line)
                setNotificationFeedback({ kind: "err", text: line })
                return
            }
            const okLine = "LINE通知の文面を保存しました"
            setMsg(okLine)
            setNotificationFeedback({ kind: "ok", text: okLine })
            await loadNotificationMessages()
        } finally {
            setSavingNotifications(false)
        }
    }

    const saveFeatureFlags = async () => {
        setSavingFeatures(true)
        setMsg("")
        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/feature-flags${adminTenantQs(tenantId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tenantId,
                flags: { vehicle_color_plate: featureVehicleColorPlate },
            }),
        })
        const json = await res.json().catch(() => ({}))
        setSavingFeatures(false)
        if (!res.ok) {
            setMsg(`機能フラグの保存に失敗: ${json?.error || ""}`)
            return
        }
        setMsg("機能フラグを保存しました")
        await loadFeatureFlags()
    }

    const updateWeekly = (i: number, patch: Partial<WeeklyRow>) => {
        setWeekly((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    }

    const addException = () => {
        setExceptions((prev) => [
            ...prev,
            {
                exception_date: new Date().toISOString().slice(0, 10),
                is_closed: true,
                open_time: null,
                close_time: null,
            },
        ])
    }

    if (ready && !canManageSettings) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                    <p className="font-semibold">店舗設定を変更する権限がありません</p>
                    <p className="mt-2 text-sm">スタッフは予約管理のみ操作できます。</p>
                    <Link href="/admin" className="mt-4 inline-block text-indigo-700 underline">
                        管理トップへ
                    </Link>
                </div>
            </div>
        )
    }

    if (loading) {
        return <div className="p-6 text-slate-800">読み込み中...</div>
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-2xl font-bold text-slate-900">店舗設定</h1>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        {operatorRole === "superadmin" ? (
                            <Link href="/admin/line-channel-setup" className="font-medium text-indigo-700 hover:underline">
                                LINE接続設定（運営）
                            </Link>
                        ) : null}
                        <Link href="/admin" className="font-medium text-indigo-700 hover:underline">
                            管理トップへ戻る
                        </Link>
                    </div>
                </div>
                {msg && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
                        {msg}
                    </p>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-lg font-semibold text-slate-900">店舗ロゴ</h2>
                    <p className="mb-4 text-sm text-slate-600">
                        予約ページ左上に表示されます。画像は自動で枠に収まるように調整します。
                    </p>

                    <div className="flex flex-wrap items-start gap-4">
                        <div className="h-16 w-16 overflow-hidden rounded-md border border-slate-200 bg-white">
                            {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={logoUrl}
                                    alt="店舗ロゴ"
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                                    ロゴなし
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-[240px]">
                            <label className="block text-xs font-medium text-slate-600">画像アップロード</label>
                            <input
                                type="file"
                                accept="image/*"
                                className="mt-1 block w-full text-sm"
                                onChange={(e) => {
                                    const f = e.target.files?.[0] || null
                                    setLogoFile(f)
                                }}
                            />

                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={!logoFile || uploadingLogo}
                                    onClick={uploadLogo}
                                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {uploadingLogo ? "アップロード中…" : "アップロード"}
                                </button>

                                <button
                                    type="button"
                                    disabled={!logoUrl || uploadingLogo}
                                    onClick={deleteLogo}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    削除
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-lg font-semibold text-slate-900">メニュー・料金</h2>
                    <p className="mb-4 text-sm text-slate-600">
                        料金の正はデータベースの <code className="rounded bg-slate-100 px-1">service_menu_items</code>{" "}
                        です。下の一覧で S/M/L・内装の金額を変更し、それ以外のメニューは追加フォームから登録します（追加行も同じ一覧に並びます）。
                    </p>
                    {menus.length === 0 && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                            <p className="mb-2 font-medium">
                                まだメニュー行がありません。マイグレーション未適用の場合は Supabase に SQL
                                を流すと S/M/L・内装の 4 行が入ります。
                            </p>
                            <button
                                type="button"
                                disabled={seeding}
                                onClick={seedDefaultMenus}
                                className="rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50"
                            >
                                {seeding ? "登録中…" : "標準メニュー（S/M/L・内装）を DB に登録"}
                            </button>
                        </div>
                    )}
                    <div className="space-y-3">
                        {sortedMenus.map((m) => (
                            <div
                                key={m.id}
                                className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3"
                            >
                                <div className="min-w-[9rem]">
                                    <p className="text-xs font-medium text-slate-600">種別</p>
                                    <p className="text-sm font-semibold text-slate-900">
                                        {SLUG_ROLE_LABEL[m.slug] || "その他メニュー"}
                                    </p>
                                    <p className="font-mono text-xs text-slate-500">{m.slug}</p>
                                </div>
                                <div className="min-w-[10rem] flex-1">
                                    <label className="text-xs font-medium text-slate-600">表示名</label>
                                    <input
                                        defaultValue={m.label}
                                        id={`label-${m.id}`}
                                        className="mt-0.5 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                                    />
                                </div>
                                <div className="w-28">
                                    <label className="text-xs font-medium text-slate-600">料金（円）</label>
                                    <input
                                        type="number"
                                        defaultValue={m.price}
                                        id={`price-${m.id}`}
                                        className="mt-0.5 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                                    />
                                </div>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                                    <input type="checkbox" defaultChecked={m.active} id={`active-${m.id}`} />
                                    有効
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const label = (
                                            document.getElementById(`label-${m.id}`) as HTMLInputElement
                                        ).value
                                        const price = Number(
                                            (document.getElementById(`price-${m.id}`) as HTMLInputElement).value
                                        )
                                        const active = (document.getElementById(`active-${m.id}`) as HTMLInputElement)
                                            .checked
                                        saveMenuRow(m, { label, price, active })
                                    }}
                                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                                >
                                    保存
                                </button>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={addMenu} className="mt-6 border-t border-slate-200 pt-4">
                        <p className="mb-2 text-sm font-semibold text-slate-800">
                            追加メニュー（slug は表示名から自動生成します。予約画面の合計に載せるにはフォーム側の対応が別途必要です）
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <input
                                name="label"
                                placeholder="表示名"
                                className="flex-1 rounded-lg border border-slate-300 p-2 text-sm text-slate-900 placeholder:text-slate-400"
                            />
                            <input
                                name="price"
                                type="number"
                                placeholder="料金"
                                className="w-28 rounded-lg border border-slate-300 p-2 text-sm text-slate-900 placeholder:text-slate-400"
                            />
                            <button
                                type="submit"
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                            >
                                追加
                            </button>
                        </div>
                    </form>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-lg font-semibold text-slate-900">機能フラグ（店舗別）</h2>
                    <p className="mb-4 text-sm text-slate-600">
                        この店舗だけに有効にしたいオプションを切り替えます。OFF
                        のテナントでは予約フォームに項目が出ず、DBにも色・ナンバーは保存されません。
                    </p>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                        <input
                            type="checkbox"
                            className="mt-1 size-4 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
                            checked={featureVehicleColorPlate}
                            onChange={(e) => setFeatureVehicleColorPlate(e.target.checked)}
                        />
                        <span>
                            <span className="font-semibold text-slate-900">
                                車両ごとに色（略称）・ナンバーを入力させる
                            </span>
                            <span className="mt-1 block text-sm text-slate-600">
                                管理画面の予約確認では、色は入力どおり・ナンバーは下4桁のみ表示します。
                            </span>
                        </span>
                    </label>
                    <button
                        type="button"
                        disabled={savingFeatures}
                        onClick={() => void saveFeatureFlags()}
                        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {savingFeatures ? "保存中…" : "機能フラグを保存"}
                    </button>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-lg font-semibold text-slate-900">営業時間・予約枠</h2>
                    <p className="mb-4 text-sm text-slate-600">
                        基本は「全日程で同じ時間」か「曜日ごと」から選べます。開店・閉店の直後に、特定日の臨時休業・時間変更を設定できます。
                        予約可否は「1台あたり所要時間×台数」と「平均移動時間」で既存予約と重ならないか判定します。
                    </p>

                    <div className="mb-4 flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                            <input
                                type="radio"
                                name="bhmode"
                                checked={mode === "uniform"}
                                onChange={() => setMode("uniform")}
                            />
                            全日程で同じ営業時間
                        </label>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                            <input
                                type="radio"
                                name="bhmode"
                                checked={mode === "weekly"}
                                onChange={() => setMode("weekly")}
                            />
                            曜日ごとに設定
                        </label>
                    </div>

                    {mode === "uniform" && (
                        <div className="mb-4 flex flex-wrap gap-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600">開店</label>
                                <input
                                    type="time"
                                    value={uniformOpen}
                                    onChange={(e) => setUniformOpen(e.target.value)}
                                    className="mt-0.5 block rounded-lg border border-slate-300 p-2 text-slate-900"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600">閉店</label>
                                <input
                                    type="time"
                                    value={uniformClose}
                                    onChange={(e) => setUniformClose(e.target.value)}
                                    className="mt-0.5 block rounded-lg border border-slate-300 p-2 text-slate-900"
                                />
                            </div>
                        </div>
                    )}

                    {mode === "weekly" && (
                        <div className="mb-4 space-y-2">
                            {weekly
                                .slice()
                                .sort((a, b) => a.day_of_week - b.day_of_week)
                                .map((w) => {
                                    const idx = weekly.findIndex((x) => x.day_of_week === w.day_of_week)
                                    return (
                                        <div
                                            key={w.day_of_week}
                                            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2"
                                        >
                                            <span className="w-10 font-semibold text-slate-900">
                                                {DOW_JA[w.day_of_week]}
                                            </span>
                                            <label className="flex items-center gap-1 text-sm text-slate-800">
                                                <input
                                                    type="checkbox"
                                                    checked={w.is_closed}
                                                    onChange={(e) => updateWeekly(idx, { is_closed: e.target.checked })}
                                                />
                                                休業
                                            </label>
                                            {!w.is_closed && (
                                                <>
                                                    <input
                                                        type="time"
                                                        value={w.open_time || ""}
                                                        onChange={(e) =>
                                                            updateWeekly(idx, { open_time: e.target.value || null })
                                                        }
                                                        className="rounded border border-slate-300 p-1 text-sm"
                                                    />
                                                    <span>〜</span>
                                                    <input
                                                        type="time"
                                                        value={w.close_time || ""}
                                                        onChange={(e) =>
                                                            updateWeekly(idx, { close_time: e.target.value || null })
                                                        }
                                                        className="rounded border border-slate-300 p-1 text-sm"
                                                    />
                                                </>
                                            )}
                                        </div>
                                    )
                                })}
                        </div>
                    )}

                    <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-800">特定日の設定（臨時休業・時間変更）</p>
                            <button
                                type="button"
                                onClick={addException}
                                className="text-sm font-semibold text-indigo-700 hover:underline"
                            >
                                行を追加
                            </button>
                        </div>
                        <div className="space-y-2">
                            {exceptions.map((ex, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                                    <input
                                        type="date"
                                        value={ex.exception_date}
                                        onChange={(e) => {
                                            const v = e.target.value
                                            setExceptions((prev) =>
                                                prev.map((x, j) => (j === i ? { ...x, exception_date: v } : x))
                                            )
                                        }}
                                        className="rounded border border-slate-300 p-1 text-sm"
                                    />
                                    <label className="flex items-center gap-1 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={ex.is_closed}
                                            onChange={(e) => {
                                                const c = e.target.checked
                                                setExceptions((prev) =>
                                                    prev.map((x, j) =>
                                                        j === i ? { ...x, is_closed: c } : x
                                                    )
                                                )
                                            }}
                                        />
                                        休業
                                    </label>
                                    {!ex.is_closed && (
                                        <>
                                            <input
                                                type="time"
                                                value={ex.open_time || ""}
                                                onChange={(e) =>
                                                    setExceptions((prev) =>
                                                        prev.map((x, j) =>
                                                            j === i ? { ...x, open_time: e.target.value || null } : x
                                                        )
                                                    )
                                                }
                                                className="rounded border p-1 text-sm"
                                            />
                                            <span>〜</span>
                                            <input
                                                type="time"
                                                value={ex.close_time || ""}
                                                onChange={(e) =>
                                                    setExceptions((prev) =>
                                                        prev.map((x, j) =>
                                                            j === i ? { ...x, close_time: e.target.value || null } : x
                                                        )
                                                    )
                                                }
                                                className="rounded border p-1 text-sm"
                                            />
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setExceptions((prev) => prev.filter((_, j) => j !== i))}
                                        className="text-sm text-red-600 hover:underline"
                                    >
                                        削除
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-4">
                        <div>
                            <label className="text-xs font-medium text-slate-600">1台あたり平均作業時間（分）</label>
                            <input
                                type="number"
                                min={1}
                                max={1440}
                                value={avgService}
                                onChange={(e) => setAvgService(Number(e.target.value))}
                                className="mt-0.5 block w-32 rounded-lg border border-slate-300 p-2 text-slate-900"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600">平均移動時間（分）</label>
                            <input
                                type="number"
                                min={0}
                                max={480}
                                value={avgTravel}
                                onChange={(e) => setAvgTravel(Number(e.target.value))}
                                className="mt-0.5 block w-32 rounded-lg border border-slate-300 p-2 text-slate-900"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600">
                                予約受付最短リード（日）
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={30}
                                value={bookingLeadDays}
                                onChange={(e) => setBookingLeadDays(Number(e.target.value))}
                                className="mt-0.5 block w-24 rounded-lg border border-slate-300 p-2 text-slate-900"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600">
                                予約受付最短リード（時）
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={23}
                                value={bookingLeadHours}
                                onChange={(e) => setBookingLeadHours(Number(e.target.value))}
                                className="mt-0.5 block w-24 rounded-lg border border-slate-300 p-2 text-slate-900"
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={saving}
                        onClick={saveScheduling}
                        className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {saving ? "保存中…" : "営業・予約設定を保存"}
                    </button>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-lg font-semibold text-slate-900">LINE通知の文面</h2>
                    <div aria-live="polite" className="mb-4 min-h-[1.25rem]">
                        {notificationFeedback ? (
                            <p
                                className={
                                    notificationFeedback.kind === "ok"
                                        ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
                                        : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900"
                                }
                            >
                                {savingNotifications && notificationFeedback.kind === "ok"
                                    ? "保存しました。再読み込み中…"
                                    : notificationFeedback.text}
                            </p>
                        ) : savingNotifications ? (
                            <p className="text-sm font-medium text-slate-600">保存中です…</p>
                        ) : null}
                    </div>
                    <p className="mb-4 text-sm text-slate-600">
                        予約完了・変更・キャンセル時のプッシュ、前日リマインドの文章を店舗ごとに変えられます。未入力の項目は標準テンプレートが使われます。管理者通知先を登録すると、お客様と同じ文面が追加送信されます。LIFF
                        やチャネル認証情報の登録は運営の「LINE接続設定」です。
                    </p>
                    <p className="mb-4 text-xs text-slate-500">
                        プレースホルダ:{" "}
                        <code className="rounded bg-slate-100 px-1">
                            {"{{customer_name}} {{tenant_name}} {{reservation_date}} {{reservation_time}} {{cars_summary}} {{address}} {{edit_url}} {{cancel_url}}"}
                        </code>
                    </p>

                    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="mb-2 text-sm font-semibold text-slate-800">管理者通知先 LINE ID（複数可）</p>
                        <p className="mb-2 text-xs text-slate-600">
                            1行に1件。店舗の公式LINEを友だち追加したアカウントの user ID（U で始まる33文字）を登録してください。予約完了・変更・キャンセル時に、お客様と同じ通知が届きます。
                        </p>
                        <textarea
                            value={adminNotifyLineIdsText}
                            onChange={(e) => setAdminNotifyLineIdsText(e.target.value)}
                            placeholder={"Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\nUyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"}
                            rows={4}
                            spellCheck={false}
                            className="w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-sm text-slate-900"
                        />
                    </div>

                    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                            <input
                                type="checkbox"
                                checked={reminderEnabled}
                                onChange={(e) => setReminderEnabled(e.target.checked)}
                            />
                            前日リマインダー通知を有効化
                        </label>
                        <p className="mb-2 text-xs text-slate-600">リマインド用テンプレート（空欄なら標準）</p>
                        <textarea
                            value={reminderTemplate}
                            onChange={(e) => setReminderTemplate(e.target.value)}
                            placeholder="未入力時は標準テンプレートを使用します"
                            rows={5}
                            className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900"
                        />
                    </div>

                    <div className="mb-4">
                        <p className="mb-2 text-sm font-semibold text-slate-800">予約完了時のLINE（プッシュ）</p>
                        <textarea
                            value={completeLineTemplate}
                            onChange={(e) => setCompleteLineTemplate(e.target.value)}
                            placeholder="未入力時は標準テンプレートを使用します"
                            rows={6}
                            className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                        />
                    </div>

                    <div className="mb-4">
                        <p className="mb-2 text-sm font-semibold text-slate-800">予約変更完了時のLINE（プッシュ）</p>
                        <textarea
                            value={changeLineTemplate}
                            onChange={(e) => setChangeLineTemplate(e.target.value)}
                            placeholder="未入力時は標準テンプレートを使用します"
                            rows={6}
                            className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                        />
                    </div>

                    <div className="mb-4">
                        <p className="mb-2 text-sm font-semibold text-slate-800">予約キャンセル時のLINE（プッシュ）</p>
                        <textarea
                            value={cancelLineTemplate}
                            onChange={(e) => setCancelLineTemplate(e.target.value)}
                            placeholder="未入力時は標準テンプレートを使用します"
                            rows={6}
                            className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                        />
                    </div>

                    <button
                        type="button"
                        disabled={savingNotifications}
                        onClick={() => void saveNotificationMessages()}
                        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {savingNotifications ? "保存中…" : "LINE通知の文面を保存"}
                    </button>
                </section>
            </div>
        </div>
    )
}
