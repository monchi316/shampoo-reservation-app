"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { setTenantContextToStorage } from "../lib/tenantClient"

export default function CancelPage() {
    const searchParams = useSearchParams()
    const id = searchParams.get('id')
    const groupId = searchParams.get('groupId')
    const tenantId = searchParams.get("tenantId")
    const router = useRouter()

    const [status, setStatus] = useState<'confirm' | 'loading' | 'done' | 'error'>('confirm')

    const handleCancel = async () => {
        if (!id) return

        setStatus("loading")

        const url = new URL("/api/cancel-reservation", window.location.origin)
        url.searchParams.set("id", id)
        if (groupId) url.searchParams.set("groupId", groupId)
        if (tenantId) url.searchParams.set("tenantId", tenantId)

        const res = await fetch(url.toString())
        if (!res.ok) {
            console.error(await res.json().catch(() => ({})))
            setStatus("error")
            return
        }
        setStatus("done")
    }

    const handleChange = () => {
        if (!id) return
        // Jump to edit page with the same reservation id.
        router.push(
            groupId
                ? `/edit-reservation?id=${id}&groupId=${groupId}${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`
                : `/edit-reservation?id=${id}${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ""}`
        )
    }

    useEffect(() => {
        if (tenantId) {
            setTenantContextToStorage({ tenantId, liffId: null })
        }
    }, [tenantId])

    if (!id) {
        return <div className="p-4 text-center">予約IDが見つかりません</div>
    }

    return (
        <div className="p-6 text-center">
            <h1 className="text-xl font-bold mb-6">予約キャンセル</h1>

            {status === 'confirm' && (
                <>
                    <p className="mb-6">この予約をキャンセルしますか？</p>

                    <div className="flex flex-col gap-4">
                        <button
                            onClick={handleCancel}
                            className="bg-red-500 text-white px-4 py-2 rounded"
                        >
                            キャンセルする
                        </button>

                        <button
                            onClick={handleChange}
                            className="bg-blue-500 text-white px-4 py-2 rounded"
                        >
                            予約を変更する
                        </button>
                    </div>
                </>
            )}

            {status === 'loading' && <p>処理中…</p>}

            {status === 'done' && (
                <>
                    <p className="text-green-600 font-bold mb-4">
                        キャンセル完了しました！
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-gray-800 text-white px-4 py-2 rounded"
                    >
                        トップへ戻る
                    </button>
                </>
            )}

            {status === 'error' && (
                <p className="text-red-600 font-bold">
                    エラーが発生しました
                </p>
            )}
        </div>
    )
}