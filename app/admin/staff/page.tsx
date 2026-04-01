"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useAdminTenant } from "../adminTenantContext"

type Row = {
    id: string
    email: string
    displayName: string | null
    role: string
    isActive: boolean
}

export default function AdminStaffPage() {
    const { tenantId, ready, canManageSettings } = useAdminTenant()
    const [rows, setRows] = useState<Row[]>([])
    const [loading, setLoading] = useState(true)
    const [msg, setMsg] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [displayName, setDisplayName] = useState("")
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        if (!tenantId) return
        setLoading(true)
        const res = await fetch(`/api/admin/operators?tenantId=${encodeURIComponent(tenantId)}`)
        const json = await res.json().catch(() => ({}))
        setLoading(false)
        if (!res.ok) {
            setMsg(json?.error || "一覧の取得に失敗しました")
            setRows([])
            return
        }
        setRows(Array.isArray(json.data) ? json.data : [])
        setMsg("")
    }, [tenantId])

    useEffect(() => {
        if (!ready || !tenantId || !canManageSettings) return
        void load()
    }, [ready, tenantId, canManageSettings, load])

    const addStaff = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!tenantId) return
        setSaving(true)
        setMsg("")
        const res = await fetch(`/api/admin/operators?tenantId=${encodeURIComponent(tenantId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: email.trim(),
                password,
                displayName: displayName.trim() || undefined,
                tenantId,
            }),
        })
        const json = await res.json().catch(() => ({}))
        setSaving(false)
        if (!res.ok) {
            setMsg(json?.error || "登録に失敗しました")
            return
        }
        setEmail("")
        setPassword("")
        setDisplayName("")
        setMsg("スタッフを登録しました")
        void load()
    }

    const deactivate = async (id: string) => {
        if (!tenantId) return
        if (!window.confirm("このアカウントを無効にしますか？")) return
        const res = await fetch(
            `/api/admin/operators/${id}?tenantId=${encodeURIComponent(tenantId)}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: false }),
            }
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            setMsg(json?.error || "更新に失敗しました")
            return
        }
        void load()
    }

    const resetPassword = async (id: string, emailText: string) => {
        if (!tenantId) return
        const next = window.prompt(`新しいパスワードを入力してください（8文字以上）\n対象: ${emailText}`)
        if (next == null) return
        if (next.length < 8) {
            setMsg("新しいパスワードは8文字以上にしてください")
            return
        }
        const res = await fetch(
            `/api/admin/operators/${id}/password?tenantId=${encodeURIComponent(tenantId)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword: next }),
            }
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            setMsg(json?.error || "パスワード再設定に失敗しました")
            return
        }
        setMsg("パスワードを再設定しました（対象スタッフへ共有してください）")
    }

    if (!ready) {
        return <div className="p-8 text-center text-slate-600">読み込み中…</div>
    }

    if (!canManageSettings) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                    <p className="font-semibold">この画面にアクセスする権限がありません</p>
                    <p className="mt-2 text-sm">スタッフは予約管理のみ操作できます。</p>
                    <Link href="/admin" className="mt-4 inline-block text-indigo-700 underline">
                        管理トップへ
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-2xl font-bold text-slate-900">スタッフ管理</h1>
                    <Link href="/admin" className="text-sm font-medium text-indigo-700 hover:underline">
                        管理トップへ
                    </Link>
                </div>
                <p className="mb-6 text-sm text-slate-600">
                    この店舗で予約管理を操作するスタッフを追加します。売上・メニュー・営業時間の変更はできません。
                </p>

                <form onSubmit={(e) => void addStaff(e)} className="mb-10 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">スタッフを追加</p>
                    <div>
                        <label className="mb-1 block text-sm text-slate-700">メール</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900"
                            autoComplete="off"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm text-slate-700">初期パスワード（8文字以上）</label>
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900"
                            autoComplete="new-password"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm text-slate-700">表示名（任意）</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving || !tenantId}
                        className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        {saving ? "登録中…" : "登録"}
                    </button>
                </form>

                {msg ? <p className="mb-4 text-sm text-slate-700">{msg}</p> : null}

                <p className="mb-2 text-sm font-semibold text-slate-900">登録済み</p>
                {loading ? (
                    <p className="text-slate-600">読み込み中…</p>
                ) : rows.length === 0 ? (
                    <p className="text-sm text-slate-600">まだスタッフがいません</p>
                ) : (
                    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                        {rows.map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                <div>
                                    <p className="font-medium text-slate-900">{r.email}</p>
                                    <p className="text-xs text-slate-500">
                                        {r.displayName || "—"} / {r.role === "owner" ? "オーナー" : "スタッフ"}
                                        {!r.isActive ? "（無効）" : ""}
                                    </p>
                                </div>
                                {r.role === "staff" ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void resetPassword(r.id, r.email)}
                                            className="rounded border border-indigo-300 bg-white px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
                                        >
                                            パスワード再設定
                                        </button>
                                        {r.isActive ? (
                                            <button
                                                type="button"
                                                onClick={() => void deactivate(r.id)}
                                                className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                                            >
                                                無効化
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
