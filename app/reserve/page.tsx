'use client'

import { useEffect, useState } from 'react'
import StepForm from '../components/StepForm'
import LiffInit from '../components/LiffInit'

export type CarForm = {
    maker: string
    model: string
    size: string
    isManualCar: boolean
}

// Reservation form state shared across all steps.
export type FormData = {
    cars: CarForm[]
    interior: boolean
    date: string
    time: string
    address: string
    addressType: 'home' | 'work' | 'other'
    homeAddress: string
    workAddress: string
    otherAddress: string
}

export default function ReservePage() {
    // Current step number (1 -> 4)
    const [step, setStep] = useState(1)

    // User input collected through the step form.
    const [formData, setFormData] = useState<FormData>({
        cars: [
            { maker: '', model: '', size: '', isManualCar: false },
        ],
        interior: false,
        date: '',
        time: '',
        address: '',
        addressType: 'home',
        homeAddress: '',
        workAddress: '',
        otherAddress: '',
    })

    useEffect(() => {
        const fillFromLastReservation = async () => {
            // LIFF初期化直後は localStorage.user がまだ無いことがあるため、
            // 短時間だけリトライして userId を待つ。
            let profile: any = {}
            for (let i = 0; i < 10; i++) {
                profile = JSON.parse(localStorage.getItem('user') || '{}')
                if (profile?.userId) break
                await new Promise((resolve) => setTimeout(resolve, 200))
            }
            if (!profile?.userId) return

            const res = await fetch(
                `/api/users/profile?userId=${encodeURIComponent(profile.userId)}`
            )
            if (!res.ok) return
            const json = await res.json()
            const data = json?.data
            if (!data) return

            const normalizedCars =
                Array.isArray(data.cars) && data.cars.length > 0
                    ? data.cars
                        .slice(0, 3)
                        .map((car: any) => ({
                            maker: car?.maker || '',
                            model: car?.model || '',
                            size: car?.size || '',
                            isManualCar: false,
                        }))
                    : [
                        {
                            maker: data.maker || '',
                            model: data.model || '',
                            size: data.size || '',
                            isManualCar: false,
                        },
                    ]

            const savedAddress =
                data?.last_address ||
                data?.address ||
                ''

            const savedAddressType =
                data?.last_address_type === 'work' || data?.last_address_type === 'other'
                    ? data.last_address_type
                    : 'home'

            setFormData((prev) => ({
                ...prev,
                cars: normalizedCars,
                address: savedAddress,
                addressType: savedAddressType,
                homeAddress: data?.home_address || '',
                workAddress: data?.work_address || '',
                otherAddress: data?.other_address || '',
            }))
        }

        fillFromLastReservation()
    }, [])

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8 px-4">
            {/* Initialize LINE login/profile on new reservation flow */}
            <LiffInit />

            <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">
                    洗車予約フォーム
                </h1>
                <p className="mb-6 text-sm text-slate-600">
                    必要事項を入力して、最後に予約内容を確定してください。
                </p>

                <StepForm
                    step={step}
                    setStep={setStep}
                    formData={formData}
                    setFormData={setFormData}
                />
            </div>
        </div>
    )
}