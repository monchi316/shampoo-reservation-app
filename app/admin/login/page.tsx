"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function AdminLoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const from = searchParams.get("from") || "/admin"

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)
        try {
            const res = await fetch("/api/admin/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(typeof json?.error === "string" ? json.error : "ログインに失敗しました")
                setLoading(false)
                return
            }
            router.replace(from.startsWith("/") ? from : "/admin")
            router.refresh()
        } catch {
            setError("通信エラーが発生しました")
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="mb-2 text-xl font-bold text-slate-900">管理画面ログイン</h1>
                <p className="mb-6 text-sm text-slate-600">Phase 2: オペレーター認証</p>
                <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
                    <div>
                        <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-slate-800">
                            メールアドレス
                        </label>
                        <input
                            id="admin-email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-slate-800">
                            パスワード
                        </label>
                        <input
                            id="admin-password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900"
                            required
                        />
                    </div>
                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                        {loading ? "ログイン中…" : "ログイン"}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default function AdminLoginPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-100">読み込み中…</div>}>
            <AdminLoginForm />
        </Suspense>
    )
}
