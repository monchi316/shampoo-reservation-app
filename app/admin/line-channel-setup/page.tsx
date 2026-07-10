"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useAdminTenant } from "../adminTenantContext"

function adminTenantQs(tenantId: string | null) {
    if (!tenantId) return ""
    return `?tenantId=${encodeURIComponent(tenantId)}`
}

export default function LineChannelSetupPage() {
    const { tenantId, ready, operatorRole } = useAdminTenant()
    const [loading, setLoading] = useState(true)
    const [msg, setMsg] = useState("")
    const [savingLine, setSavingLine] = useState(false)
    const [lineLiffId, setLineLiffId] = useState("")
    const [lineChannelId, setLineChannelId] = useState("")
    const [lineChannelSecret, setLineChannelSecret] = useState("")
    const [lineChannelAccessToken, setLineChannelAccessToken] = useState("")
    const [linePushEnabled, setLinePushEnabled] = useState(true)
    const [lineTokenLast4, setLineTokenLast4] = useState<string | null>(null)
    const [lineConfigured, setLineConfigured] = useState(false)
    const [lineEncryptionReady, setLineEncryptionReady] = useState(true)

    const loadLineChannel = useCallback(async () => {
        if (!tenantId) return
        const res = await fetch(`/api/admin/tenant/line-channel${adminTenantQs(tenantId)}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            setMsg(typeof json?.error === "string" ? json.error : "LINE接続設定の取得に失敗しました")
            return
        }
        setLineLiffId(String(json?.liff_id || ""))
        setLineChannelId(String(json?.line_channel_id || ""))
        setLinePushEnabled(json?.line_push_enabled !== false)
        setLineTokenLast4((json?.line_token_last4 as string | null) || null)
        setLineConfigured(!!json?.configured)
        setLineEncryptionReady(json?.encryption_ready !== false)
        setLineChannelSecret("")
        setLineChannelAccessToken("")
    }, [tenantId])

    useEffect(() => {
        if (!ready || operatorRole !== "superadmin") {
            setLoading(false)
            return
        }
        if (!tenantId) {
            setLoading(false)
            return
        }
        ;(async () => {
            setLoading(true)
            setMsg("")
            await loadLineChannel()
            setLoading(false)
        })()
    }, [ready, tenantId, operatorRole, loadLineChannel])

    const saveLineChannel = async () => {
        setSavingLine(true)
        setMsg("")
        if (!tenantId) return
        const payload: Record<string, unknown> = {
            liff_id: lineLiffId,
            line_channel_id: lineChannelId,
            line_push_enabled: linePushEnabled,
            is_active: true,
        }
        if (lineChannelSecret.trim()) payload.line_channel_secret = lineChannelSecret.trim()
        if (lineChannelAccessToken.trim()) payload.line_channel_access_token = lineChannelAccessToken.trim()

        const res = await fetch(`/api/admin/tenant/line-channel${adminTenantQs(tenantId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
        const json = await res.json().catch(() => ({}))
        setSavingLine(false)
        if (!res.ok) {
            setMsg(`保存失敗: ${json?.error || ""}`)
            return
        }
        setMsg("LINE接続設定を保存しました")
        await loadLineChannel()
    }

    if (!ready) {
        return <div className="p-6 text-slate-800">読み込み中…</div>
    }

    if (operatorRole !== "superadmin") {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                    <p className="font-semibold">LINE接続設定は運営（スーパー管理者）のみ操作できます。</p>
                    <Link href="/admin" className="mt-4 inline-block text-indigo-700 underline">
                        管理トップへ
                    </Link>
                </div>
            </div>
        )
    }

    if (loading) {
        return <div className="p-6 text-slate-800">読み込み中…</div>
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-2xl font-bold text-slate-900">LINE接続設定（運営）</h1>
                    <Link href="/admin/settings" className="text-sm font-medium text-indigo-700 hover:underline">
                        店舗設定へ
                    </Link>
                </div>
                <p className="text-sm text-slate-600">
                    LIFF・チャネル ID・トークン等は店舗オーナーではなく運営が登録します。通知の文面は「店舗設定」の「LINE通知の文面」で変更できます。
                </p>
                {msg && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
                        {msg}
                    </p>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-lg font-semibold text-slate-900">Messaging API / LIFF</h2>
                    <p className="mb-4 text-sm text-slate-600">
                        店舗ごとの LINE チャネル情報です。トークン／シークレットは暗号化して保存され、画面には再表示されません。
                    </p>
                    {!lineEncryptionReady && (
                        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            サーバーの <code className="rounded bg-amber-100 px-1">LINE_CREDENTIALS_ENCRYPTION_KEY</code>{" "}
                            が未設定です（32文字以上）。
                        </p>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                        <div>
                            <label className="text-xs font-medium text-slate-600">LIFF ID</label>
                            <input
                                value={lineLiffId}
                                onChange={(e) => setLineLiffId(e.target.value)}
                                className="mt-0.5 block w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                                placeholder="200xxxxxxx-xxxxxxx"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600">Channel ID</label>
                            <input
                                value={lineChannelId}
                                onChange={(e) => setLineChannelId(e.target.value)}
                                className="mt-0.5 block w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                                placeholder="200xxxxxxxxx"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600">
                                Channel Secret（更新時のみ入力）
                            </label>
                            <input
                                value={lineChannelSecret}
                                onChange={(e) => setLineChannelSecret(e.target.value)}
                                className="mt-0.5 block w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                                placeholder="入力時のみ上書き保存"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600">
                                Channel Access Token（更新時のみ入力）
                            </label>
                            <input
                                value={lineChannelAccessToken}
                                onChange={(e) => setLineChannelAccessToken(e.target.value)}
                                className="mt-0.5 block w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                                placeholder="入力時のみ上書き保存"
                            />
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                        <label className="flex items-center gap-2 text-slate-900">
                            <input
                                type="checkbox"
                                checked={linePushEnabled}
                                onChange={(e) => setLinePushEnabled(e.target.checked)}
                            />
                            LINE Push 通知を有効化
                        </label>
                        <span className="text-slate-600">
                            状態: {lineConfigured ? "設定済み" : "未設定"}
                            {lineTokenLast4 ? `（token末尾: ****${lineTokenLast4}）` : ""}
                        </span>
                    </div>
                    <button
                        type="button"
                        disabled={savingLine}
                        onClick={() => void saveLineChannel()}
                        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {savingLine ? "保存中…" : "保存"}
                    </button>
                </section>
            </div>
        </div>
    )
}
