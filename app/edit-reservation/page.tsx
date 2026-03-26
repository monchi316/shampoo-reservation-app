'use client'

import { Suspense } from 'react'
import EditReservationPage from './EditReservationPage'

export default function Page() {
    return (
        <Suspense fallback={<div className="p-4 text-center">読み込み中...</div>}>
            <EditReservationPage />
        </Suspense>
    )
}
