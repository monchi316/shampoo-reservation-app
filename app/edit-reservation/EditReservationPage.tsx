"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import StepForm from "../components/StepForm"
import TenantLogo from "../components/TenantLogo"
import { setTenantContextToStorage } from "../lib/tenantClient"

type FormData = {
    cars: Array<{
        maker: string
        model: string
        size: string
        isManualCar: boolean
        selectedAddonSlugs: string[]
    }>
    interior: boolean
    date: string
    time: string
    address: string
    addressType: 'home' | 'work' | 'other'
    homeAddress: string
    workAddress: string
    otherAddress: string
}

export default function EditReservationPage() {
    // URLの ?id=... から編集対象の予約IDを取得。
    const searchParams = useSearchParams()
    const reservationId = searchParams.get("id")
    const groupIdParam = searchParams.get("groupId")
    const tenantIdParam = searchParams.get("tenantId")
    // StepFormの表示ステップ
    const [step, setStep] = useState(1)
    // 初期データ取得中フラグ
    const [loading, setLoading] = useState(true)
    // LINE通知先ユーザーID（更新通知で利用）
    const [targetUserId, setTargetUserId] = useState<string>("")
    // DBに保存されているユーザー名（更新通知や再保存で利用）
    const [targetUserName, setTargetUserName] = useState<string>("")
    const [targetGroupId, setTargetGroupId] = useState<string>("")
    // 編集フォームの入力状態
    const [formData, setFormData] = useState<FormData>({
        cars: [{ maker: "", model: "", size: "", isManualCar: false, selectedAddonSlugs: [] }],
        interior: false,
        date: "",
        time: "",
        address: "",
        addressType: "home",
        homeAddress: "",
        workAddress: "",
        otherAddress: "",
    })

    useEffect(() => {
        const fetchReservation = async () => {
            if (tenantIdParam) {
                setTenantContextToStorage({ tenantId: tenantIdParam, liffId: null })
            }
            if (!reservationId && !groupIdParam) {
                setLoading(false)
                return
            }
            // groupId があればグループ全体、無ければ id（RLS 回避のため API 経由）
            let firstRow: any = null
            let rows: any[] = []
            if (groupIdParam) {
                const res = await fetch(
                    `/api/public/reservations?groupId=${encodeURIComponent(groupIdParam)}&tenantId=${encodeURIComponent(tenantIdParam || "")}`
                )
                const json = await res.json().catch(() => ({}))
                if (!res.ok || !Array.isArray(json.data) || json.data.length === 0) {
                    console.error("予約取得エラー:", json)
                    setLoading(false)
                    return
                }
                rows = json.data
                firstRow = json.data[0]
            } else {
                const res = await fetch(
                    `/api/public/reservations?id=${encodeURIComponent(reservationId!)}&tenantId=${encodeURIComponent(tenantIdParam || "")}`
                )
                const json = await res.json().catch(() => ({}))
                if (!res.ok || !Array.isArray(json.data) || json.data.length === 0) {
                    console.error("予約取得エラー:", json)
                    setLoading(false)
                    return
                }
                rows = json.data
                firstRow = json.data[0]
            }

            setTargetUserId(firstRow.user_id || "")
            setTargetUserName(firstRow.user_name || "")
            setTargetGroupId(firstRow.group_id || groupIdParam || "")

            // users テーブルから住所辞書（自宅/職場/その他）を取得
            let addressBook = {
                homeAddress: "",
                workAddress: "",
                otherAddress: "",
                lastAddressType: "home" as "home" | "work" | "other",
            }
            if (firstRow.user_id) {
                const userRes = await fetch(
                    `/api/users/profile?userId=${encodeURIComponent(firstRow.user_id)}`
                )
                if (userRes.ok) {
                    const userJson = await userRes.json()
                    const userData = userJson?.data || {}
                    addressBook = {
                        homeAddress: userData.home_address || "",
                        workAddress: userData.work_address || "",
                        otherAddress: userData.other_address || "",
                        lastAddressType:
                            userData.last_address_type === "work" ||
                            userData.last_address_type === "other"
                                ? userData.last_address_type
                                : "home",
                    }
                }
            }

            setFormData({
                cars: rows.slice(0, 3).map((r: any) => ({
                    maker: r.maker || "",
                    model: r.model || "",
                    size: r.size || "",
                    isManualCar: false,
                    selectedAddonSlugs: Array.isArray(r.addon_slugs)
                        ? r.addon_slugs.filter((x: unknown): x is string => typeof x === "string")
                        : r.interior
                          ? ["interior_addon"]
                          : [],
                })),
                interior: !!firstRow.interior,
                date: firstRow.date || "",
                time: firstRow.time || "",
                address: firstRow.address || "",
                addressType: addressBook.lastAddressType,
                homeAddress: addressBook.homeAddress,
                workAddress: addressBook.workAddress,
                otherAddress: addressBook.otherAddress,
            })
            setLoading(false)
        }

        // ページ表示時に1回だけ読み込む（id変更時は再読み込み）。
        fetchReservation()
    }, [reservationId, groupIdParam, tenantIdParam])

    if (!reservationId && !groupIdParam) {
        return <div className="p-4 text-center">予約IDが見つかりません</div>
    }

    if (loading) {
        return <div className="p-4 text-center">予約情報を読み込み中...</div>
    }

    return (
        <div className="p-4 max-w-md mx-auto">
            <div className="mb-4 flex items-start gap-3">
                <TenantLogo className="h-12 w-12 shrink-0" />
                <h1 className="text-xl font-bold">予約変更フォーム</h1>
            </div>
            {/* StepFormを更新モードで再利用する。 */}
            <StepForm
                step={step}
                setStep={setStep}
                formData={formData}
                setFormData={setFormData}
                mode="update"
                reservationId={reservationId}
                targetUserId={targetUserId}
                targetUserName={targetUserName}
                targetGroupId={targetGroupId}
            />
        </div>
    )
}
