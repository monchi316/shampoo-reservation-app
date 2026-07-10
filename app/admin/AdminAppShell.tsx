"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
    AdminTenantContext,
    type AdminOperatorRole,
    type AdminTenantOption,
} from "./adminTenantContext"

const STORAGE_KEY = "admin_selected_tenant_v1"

export default function AdminAppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()

    const [tenants, setTenants] = useState<AdminTenantOption[]>([])
    const [tenantId, setTenantIdState] = useState<string | null>(null)
    const [ready, setReady] = useState(false)
    const [operatorRole, setOperatorRole] = useState<AdminOperatorRole | null>(null)

    const setTenantId = useCallback((id: string) => {
        setTenantIdState(id)
        try {
            localStorage.setItem(STORAGE_KEY, id)
        } catch {
            // ignore
        }
    }, [])

    const loadSession = useCallback(async () => {
        const fromPath = pathname || "/admin"
        const res = await fetch("/api/admin/auth/session")
        if (res.status === 401) {
            router.replace(`/admin/login?from=${encodeURIComponent(fromPath)}`)
            return
        }
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            // 401 以外（例: ADMIN_SESSION_SECRET 未設定等）でも認証が成立していないためログインへ戻す
            router.replace(`/admin/login?from=${encodeURIComponent(fromPath)}`)
            return
        }
        const list: AdminTenantOption[] = Array.isArray(json.tenants) ? json.tenants : []
        setTenants(list)
        const r = json?.operator?.role as string | undefined
        const role: AdminOperatorRole | null =
            r === "superadmin" || r === "owner" || r === "staff" ? r : null
        setOperatorRole(role)

        let saved: string | null = null
        try {
            saved = localStorage.getItem(STORAGE_KEY)
        } catch {
            saved = null
        }
        const ids = new Set(list.map((t) => t.id))
        const pick =
            (saved && ids.has(saved) ? saved : null) ||
            (list.length === 1 ? list[0].id : null) ||
            (list.length > 0 ? list[0].id : null)
        setTenantIdState(pick)
        setReady(true)
    }, [pathname, router])

    useEffect(() => {
        if (pathname === "/admin/login") return
        loadSession()
    }, [pathname, loadSession])

    const logout = async () => {
        await fetch("/api/admin/auth/logout", { method: "POST" })
        router.replace("/admin/login")
    }

    const canManageSettings =
        operatorRole === "superadmin" || operatorRole === "owner"

    const ctx = useMemo(
        () => ({
            tenantId,
            tenants,
            setTenantId,
            ready: pathname === "/admin/login" ? true : ready,
            operatorRole,
            canManageSettings,
        }),
        [tenantId, tenants, setTenantId, pathname, ready, operatorRole, canManageSettings]
    )

    if (pathname === "/admin/login") {
        return <>{children}</>
    }

    return (
        <AdminTenantContext.Provider value={ctx}>
            <div className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-slate-700">管理画面</span>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <span className="whitespace-nowrap">店舗</span>
                            <select
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900"
                                value={tenantId || ""}
                                disabled={!ready || tenants.length === 0}
                                onChange={(e) => setTenantId(e.target.value)}
                            >
                                {tenants.length === 0 ? (
                                    <option value="">店舗がありません</option>
                                ) : (
                                    tenants.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name || t.id}
                                        </option>
                                    ))
                                )}
                            </select>
                        </label>
                        <Link href="/admin" className="text-sm text-indigo-700 hover:underline">
                            トップ
                        </Link>
                        <Link href="/admin/account" className="text-sm text-indigo-700 hover:underline">
                            アカウント
                        </Link>
                        {canManageSettings ? (
                            <Link href="/admin/staff" className="text-sm text-indigo-700 hover:underline">
                                スタッフ
                            </Link>
                        ) : null}
                        {operatorRole === "superadmin" ? (
                            <Link
                                href="/admin/line-channel-setup"
                                className="text-sm text-indigo-700 hover:underline"
                            >
                                LINE接続
                            </Link>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={() => void logout()}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                        ログアウト
                    </button>
                </div>
            </div>
            {!ready ? (
                <div className="p-8 text-center text-slate-600">読み込み中…</div>
            ) : tenants.length === 0 ? (
                <div className="p-8 text-center text-amber-800">
                    操作可能な店舗がありません。管理者に <code className="rounded bg-amber-100 px-1">admin_operator_tenants</code>{" "}
                    の登録を依頼してください。
                </div>
            ) : (
                children
            )}
        </AdminTenantContext.Provider>
    )
}
