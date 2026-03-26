'use client'

import { Suspense } from 'react'
import CancelPage from './CancelPage'

export default function Page() {
    return (
        <Suspense fallback={<div className="p-4 text-center">読み込み中...</div>}>
            <CancelPage />
        </Suspense>
    )
}