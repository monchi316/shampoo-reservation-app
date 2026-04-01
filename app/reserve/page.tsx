'use client'

import { useEffect, useState } from 'react'
import StepForm from '../components/StepForm'
import LiffInit from '../components/LiffInit'
import TenantLogo from '../components/TenantLogo'
import {
    getTenantContextFromStorage,
    resolveTenantContextFromUrl,
    setTenantContextToStorage,
    type TenantContext,
} from '../lib/tenantClient'

export type CarForm = {
    maker: string
    model: string
    size: string
    isManualCar: boolean
    selectedAddonSlugs: string[]
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
            { maker: '', model: '', size: '', isManualCar: false, selectedAddonSlugs: [] },
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
    const [tenantCtx, setTenantCtx] = useState<TenantContext | null>(null)
    const [tenantLoading, setTenantLoading] = useState(true)
    const [tenantError, setTenantError] = useState<string | null>(null)

    useEffect(() => {
        const initTenant = async () => {
            const fromStorage = getTenantContextFromStorage()
            if (fromStorage) {
                setTenantCtx(fromStorage)
            }

            // URL に tenantId/lid が明示されているときは URL を優先する。
            // （リッチメニューで別店舗リンクへ遷移した際、前回storageが勝って誤店舗表示になるのを防ぐ）
            // 一方、LINEログイン後にクエリが消えたケースでは storage を使って文脈を維持する。
            const { tenantIdHint: urlTenantIdHint, liffId: urlLiffId } =
                resolveTenantContextFromUrl()
            const rawSp = new URLSearchParams(window.location.search)
            const hasExplicitTenantInUrl = !!(rawSp.get('tenantId') || rawSp.get('lid'))
            const tenantIdHint = hasExplicitTenantInUrl
                ? urlTenantIdHint
                : (fromStorage?.tenantId || urlTenantIdHint)
            const liffId = hasExplicitTenantInUrl
                ? urlLiffId
                : (fromStorage?.liffId || urlLiffId)
            const url = new URL('/api/public/tenant-resolve', window.location.origin)
            if (liffId) {
                url.searchParams.set('lid', liffId)
            } else {
                url.searchParams.set('tenantId', tenantIdHint)
            }
            const res = await fetch(url.toString())
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json?.tenantId) {
                setTenantError(json?.error || '店舗情報の取得に失敗しました。')
                setTenantLoading(false)
                return
            }
            const resolved: TenantContext = {
                tenantId: String(json.tenantId),
                liffId: liffId || null,
            }
            setTenantContextToStorage(resolved)
            setTenantCtx(resolved)
            setTenantLoading(false)
        }
        initTenant()
    }, [])

    useEffect(() => {
        const fillFromLastReservation = async () => {
            if (!tenantCtx) return
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
                            selectedAddonSlugs: [],
                        }))
                    : [
                        {
                            maker: data.maker || '',
                            model: data.model || '',
                            size: data.size || '',
                            isManualCar: false,
                            selectedAddonSlugs: [],
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
    }, [tenantCtx])

    if (tenantLoading) {
        return <div className="p-4 text-center">店舗情報を読み込み中...</div>
    }
    if (tenantError || !tenantCtx) {
        return (
            <div className="p-4 text-center text-red-600">
                {tenantError || '店舗情報の読み込みに失敗しました。'}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8 px-4">
            {/* Initialize LINE login/profile on new reservation flow */}
            <LiffInit liffId={tenantCtx.liffId} />

            <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-start gap-4">
                    <TenantLogo className="h-14 w-14 shrink-0" />
                    <div>
                        <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">
                            洗車予約フォーム
                        </h1>
                        <p className="text-sm text-slate-600">
                            必要事項を入力して、最後に予約内容を確定してください。
                        </p>
                    </div>
                </div>

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