'use client'

import { useEffect, useState } from 'react'

export default function CancelPage() {
    const [message, setMessage] = useState('キャンセル処理中...')

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const id = params.get('id')

        if (!id) {
            setMessage('予約IDが見つかりません')
            return
        }

        // Vercel API Route を叩く
        fetch(`/api/cancel-reservation?id=${id}`)
            .then(async (res) => {
                const text = await res.text()
                if (res.ok) {
                    setMessage('キャンセルが完了しました 🚗✨')
                } else {
                    setMessage(`エラー: ${text}`)
                }
            })
            .catch(() => setMessage('通信エラーが発生しました'))
    }, [])

    return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 text-lg">
            <p>{message}</p>
            <a href="/reserve" className="px-4 py-2 bg-blue-500 text-white rounded-lg">
                もう一度予約する
            </a>
        </div>
    )
}