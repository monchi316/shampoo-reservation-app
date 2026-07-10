'use client'

import { useCallback, useEffect, useState } from 'react'
import StepForm from '../components/StepForm'
import LiffInit, { type LiffInitStatus } from '../components/LiffInit'
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
    /** 機能フラグ vehicle_color_plate 時に使用 */
    vehicleColorAbbr: string
    vehiclePlate: string
}

type DebugTenantResolve = {
    requestUrl: string
    httpStatus: number
    ms: number
    tenantId?: string
    liffId?: string
    resolveNote?: string
    apiError?: string
    fetchError?: string
}

function ReserveDebugOverlay({
    enabled,
    debugTenantResolve,
    liffStatus,
    loading,
}: {
    enabled: boolean
    debugTenantResolve: DebugTenantResolve | null
    liffStatus: LiffInitStatus
    loading?: boolean
}) {
    if (!enabled) return null

    let lineUserLine = 'LINE userId: （未取得・localStorage 参照）'
    if (typeof window !== 'undefined') {
        try {
            const u = JSON.parse(window.localStorage.getItem('user') || '{}') as { userId?: string }
            lineUserLine = u?.userId
                ? `LINE userId: ${u.userId}`
                : 'LINE userId: （未取得）'
        } catch {
            lineUserLine = 'LINE userId: （読取エラー）'
        }
    }

    const liffLine =
        liffStatus.state === 'error'
            ? `LIFF: エラー — ${liffStatus.message}`
            : liffStatus.state === 'profile_ready'
              ? 'LIFF: プロフィール取得済み'
              : liffStatus.state === 'awaiting_login'
                ? 'LIFF: ログイン待ち'
              : liffStatus.state === 'skipped'
                ? `LIFF: スキップ (${liffStatus.reason})`
                : `LIFF: ${liffStatus.state}`

    return (
        <details
            open
            className="fixed bottom-0 left-0 right-0 z-[100] max-h-[42vh] overflow-auto border-t-2 border-amber-500 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-amber-100 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
        >
            <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                検証用デバッグ（URL に <span className="text-amber-300">?debug=1</span> を付与）
            </summary>
            <div className="mt-2 space-y-2 whitespace-pre-wrap break-all">
                {loading && !debugTenantResolve && <p className="text-slate-400">tenant-resolve: 待機中…</p>}
                {debugTenantResolve && (
                    <>
                        <p>
                            <span className="text-slate-400">tenant-resolve HTTP:</span>{' '}
                            <span
                                className={
                                    debugTenantResolve.httpStatus >= 200 && debugTenantResolve.httpStatus < 300
                                        ? 'text-green-400'
                                        : 'text-red-400'
                                }
                            >
                                {debugTenantResolve.httpStatus || '—'}
                            </span>{' '}
                            <span className="text-slate-500">({debugTenantResolve.ms}ms)</span>
                        </p>
                        <p className="text-slate-400">request:</p>
                        <p>{debugTenantResolve.requestUrl}</p>
                        {debugTenantResolve.fetchError && (
                            <p className="text-red-400">fetch 失敗: {debugTenantResolve.fetchError}</p>
                        )}
                        {debugTenantResolve.apiError && (
                            <p className="text-red-400">API: {debugTenantResolve.apiError}</p>
                        )}
                        {debugTenantResolve.tenantId && (
                            <p>
                                <span className="text-slate-400">tenantId:</span> {debugTenantResolve.tenantId}
                            </p>
                        )}
                        {debugTenantResolve.liffId && (
                            <p>
                                <span className="text-slate-400">liffId:</span> {debugTenantResolve.liffId}
                            </p>
                        )}
                        {debugTenantResolve.resolveNote && (
                            <p className="text-amber-300/95">resolveNote: {debugTenantResolve.resolveNote}</p>
                        )}
                    </>
                )}
                <p className="text-cyan-200">{liffLine}</p>
                <p className="text-cyan-200">{lineUserLine}</p>
            </div>
        </details>
    )
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
            {
                maker: '',
                model: '',
                size: '',
                isManualCar: false,
                selectedAddonSlugs: [],
                vehicleColorAbbr: '',
                vehiclePlate: '',
            },
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
    const [liffStatus, setLiffStatus] = useState<LiffInitStatus>({ state: 'idle' })
    /** iPad 等で Network を見られないとき用: URL に ?debug=1 を付けると画面に表示 */
    const [debugPanel, setDebugPanel] = useState(false)
    const [debugTenantResolve, setDebugTenantResolve] = useState<DebugTenantResolve | null>(null)
    /** URL の lid と API の liff_id が異なるとき、LiffInit が 2 番目に試す ID */
    const [liffIdFallback, setLiffIdFallback] = useState<string | null>(null)

    const onLiffStatus = useCallback((s: LiffInitStatus) => {
        setLiffStatus(s)
    }, [])

    useEffect(() => {
        const initTenant = async () => {
            const debug =
                typeof window !== 'undefined' &&
                new URLSearchParams(window.location.search).get('debug') === '1'
            setDebugPanel(debug)

            try {
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
                const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
                let res: Response
                try {
                    res = await fetch(url.toString())
                } catch (fetchErr) {
                    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
                    if (debug) {
                        setDebugTenantResolve({
                            requestUrl: url.toString(),
                            httpStatus: 0,
                            ms: Math.round(
                                (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
                                    t0
                            ),
                            fetchError: msg,
                        })
                    }
                    throw fetchErr
                }
                const json = await res.json().catch(() => ({}))
                const ms = Math.round(
                    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
                )
                if (debug) {
                    setDebugTenantResolve({
                        requestUrl: url.toString(),
                        httpStatus: res.status,
                        ms,
                        tenantId: typeof json?.tenantId === 'string' ? json.tenantId : undefined,
                        liffId: typeof json?.liffId === 'string' ? json.liffId : undefined,
                        resolveNote:
                            typeof json?.resolveNote === 'string' ? json.resolveNote : undefined,
                        apiError:
                            !res.ok
                                ? String(json?.error || res.statusText || 'HTTP error')
                                : !json?.tenantId
                                  ? '応答に tenantId がありません'
                                  : undefined,
                    })
                }
                if (!res.ok || !json?.tenantId) {
                    setLiffIdFallback(null)
                    setTenantError(json?.error || '店舗情報の取得に失敗しました。')
                    return
                }
                // 開いている LIFF では通常 URL の lid = LINE の LIFF ID。無いときだけ API 値。
                // URL と API が異なるときは LiffInit で先に URL、失敗時に API を再試行する。
                const liffFromUrlOrStorage =
                    typeof liffId === 'string' && liffId.trim().length > 0 ? liffId.trim() : null
                const liffFromApi =
                    typeof json.liffId === 'string' && json.liffId.trim().length > 0
                        ? json.liffId.trim()
                        : null
                const resolved: TenantContext = {
                    tenantId: String(json.tenantId),
                    liffId: liffFromUrlOrStorage ?? liffFromApi,
                }
                setLiffIdFallback(
                    liffFromUrlOrStorage &&
                        liffFromApi &&
                        liffFromUrlOrStorage !== liffFromApi
                        ? liffFromApi
                        : null
                )
                setTenantContextToStorage(resolved)
                setTenantCtx(resolved)
            } catch (e) {
                console.error('店舗情報の取得エラー:', e)
                setLiffIdFallback(null)
                setTenantError(
                    '店舗情報の取得中にエラーが発生しました。通信環境を確認して再度お試しください。'
                )
            } finally {
                setTenantLoading(false)
            }
        }
        void initTenant()
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
                            vehicleColorAbbr:
                                car?.vehicleColorAbbr || car?.vehicle_color_abbr || '',
                            vehiclePlate: car?.vehiclePlate || car?.vehicle_plate || '',
                        }))
                    : [
                        {
                            maker: data.maker || '',
                            model: data.model || '',
                            size: data.size || '',
                            isManualCar: false,
                            selectedAddonSlugs: [],
                            vehicleColorAbbr: '',
                            vehiclePlate: '',
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
        return (
            <>
                <div className="p-4 text-center">店舗情報を読み込み中...</div>
                <ReserveDebugOverlay
                    enabled={debugPanel}
                    debugTenantResolve={debugTenantResolve}
                    liffStatus={liffStatus}
                    loading
                />
            </>
        )
    }
    if (tenantError || !tenantCtx) {
        return (
            <>
                <div className="p-4 text-center text-red-600">
                    {tenantError || '店舗情報の読み込みに失敗しました。'}
                </div>
                <ReserveDebugOverlay
                    enabled={debugPanel}
                    debugTenantResolve={debugTenantResolve}
                    liffStatus={liffStatus}
                />
            </>
        )
    }

    const liffHelpText =
        'LINE Developers → 該当チャネル → LIFF タブで、この LIFF の「スコープ」に profile（表示名取得）をオンにしてください。openid も推奨です。変更後はユーザーに一度 LINE 内で連携解除または再ログインが必要な場合があります。エンドポイント URL は実際の予約ページ（https・ドメイン・パス・クエリ）と一致させ、tenant_channels の liff_id は LIFF ID と同一にしてください。'

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8 px-4">
            <LiffInit
                liffId={tenantCtx.liffId}
                fallbackLiffId={liffIdFallback}
                onStatus={onLiffStatus}
            />

            {!tenantCtx.liffId && (
                <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <p className="font-semibold">LINE ユーザー ID を取得する LIFF ID が未設定です</p>
                    <p className="mt-1 text-amber-900/90">
                        運営の LINE 接続設定で <code className="rounded bg-amber-100/80 px-1">tenant_channels</code>{' '}
                        に <code className="rounded bg-amber-100/80 px-1">line_liff</code> の{' '}
                        <code className="rounded bg-amber-100/80 px-1">liff_id</code>{' '}
                        が保存されているか、再デプロイ後に反映されているか確認してください。
                    </p>
                </div>
            )}

            {liffStatus.state === 'error' && (
                <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    <p className="font-semibold">
                        {/プロフィール取得|scope|permission/i.test(liffStatus.message)
                            ? 'LINE 連携（スコープ／プロフィール）の設定を確認してください'
                            : 'LINE（LIFF）の初期化に失敗しました'}
                    </p>
                    <p className="mt-1 font-mono text-xs opacity-90">{liffStatus.message}</p>
                    <p className="mt-2 text-red-900/90">{liffHelpText}</p>
                </div>
            )}

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
                    tenantId={tenantCtx.tenantId}
                />
            </div>

            <ReserveDebugOverlay
                enabled={debugPanel}
                debugTenantResolve={debugTenantResolve}
                liffStatus={liffStatus}
            />
        </div>
    )
}