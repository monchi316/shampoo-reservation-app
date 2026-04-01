"use client"

import Link from "next/link"
import { useAdminTenant } from "./adminTenantContext"

export default function AdminHomePage() {
    const { ready, canManageSettings } = useAdminTenant()

    if (!ready) {
        return (
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600">
                    読み込み中…
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="mb-2 text-2xl font-bold text-slate-900">管理画面</h1>
                <p className="mb-6 text-sm text-slate-600">
                    予約確認、ステータス変更、売上入力などの管理機能です。
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                    <Link
                        href="/admin/reservations"
                        className="rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50"
                    >
                        <p className="font-semibold text-slate-900">予約管理</p>
                        <p className="text-sm text-slate-600">予約一覧、予約詳細、ステータス更新</p>
                    </Link>

                    {canManageSettings ? (
                        <Link
                            href="/admin/sales"
                            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50"
                        >
                            <p className="font-semibold text-slate-900">売上管理</p>
                            <p className="text-sm text-slate-600">サービス実施入力、日次集計表示</p>
                        </Link>
                    ) : null}

                    {canManageSettings ? (
                        <>
                            <Link
                                href="/admin/settings"
                                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50 sm:col-span-2"
                            >
                                <p className="font-semibold text-slate-900">店舗設定</p>
                                <p className="text-sm text-slate-600">
                                    メニュー・料金、営業時間、予約可能枠（作業時間・移動時間）
                                </p>
                            </Link>
                            <Link
                                href="/admin/staff"
                                className="rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50 sm:col-span-2"
                            >
                                <p className="font-semibold text-slate-900">スタッフ管理</p>
                                <p className="text-sm text-slate-600">
                                    スタッフアカウントの追加（予約管理のみ操作可）
                                </p>
                            </Link>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
