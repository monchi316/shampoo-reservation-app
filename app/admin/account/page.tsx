"use client"

import Link from "next/link"
import { useState } from "react"

export default function AdminAccountPage() {
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState("")

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setMsg("")
        if (newPassword.length < 8) {
            setMsg("新しいパスワードは8文字以上にしてください")
            return
        }
        if (newPassword !== confirmPassword) {
            setMsg("確認用パスワードが一致しません")
            return
        }
        setSaving(true)
        const res = await fetch("/api/admin/auth/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword, newPassword }),
        })
        const json = await res.json().catch(() => ({}))
        setSaving(false)
        if (!res.ok) {
            setMsg(json?.error || "パスワード変更に失敗しました")
            return
        }
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setMsg("パスワードを変更しました")
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-900">アカウント設定</h1>
                    <Link href="/admin" className="text-sm font-medium text-indigo-700 hover:underline">
                        管理トップへ
                    </Link>
                </div>
                <p className="mb-4 text-sm text-slate-600">ログインパスワードを変更できます。</p>
                <form onSubmit={(e) => void submit(e)} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm text-slate-700">現在のパスワード</label>
                        <input
                            type="password"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900"
                            required
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm text-slate-700">新しいパスワード（8文字以上）</label>
                        <input
                            type="password"
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900"
                            minLength={8}
                            required
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm text-slate-700">新しいパスワード（確認）</label>
                        <input
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900"
                            minLength={8}
                            required
                        />
                    </div>
                    {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        {saving ? "保存中…" : "変更する"}
                    </button>
                </form>
            </div>
        </div>
    )
}

