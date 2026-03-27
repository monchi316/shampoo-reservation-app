"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import StepForm from "../components/StepForm"
import { supabase } from "../lib/supabase"

type FormData = {
    cars: Array<{
        maker: string
        model: string
        size: string
        isManualCar: boolean
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
        cars: [{ maker: "", model: "", size: "", isManualCar: false }],
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
            if (!reservationId && !groupIdParam) {
                setLoading(false)
                return
            }
            // groupId があればグループ全体、無ければ id 単体を取得。
            let firstRow: any = null
            let rows: any[] = []
            if (groupIdParam) {
                const { data, error } = await supabase
                    .from("reservations")
                    .select("*")
                    .eq("group_id", groupIdParam)
                    .order("id", { ascending: true })
                if (error || !data || data.length === 0) {
                    console.error("予約取得エラー:", error)
                    setLoading(false)
                    return
                }
                rows = data
                firstRow = data[0]
            } else {
                const { data, error } = await supabase
                    .from("reservations")
                    .select("*")
                    .eq("id", reservationId)
                    .single()

                if (error || !data) {
                    console.error("予約取得エラー:", error)
                    setLoading(false)
                    return
                }
                firstRow = data

                if (data.group_id) {
                    const { data: groupedRows } = await supabase
                        .from("reservations")
                        .select("*")
                        .eq("group_id", data.group_id)
                        .order("id", { ascending: true })
                    rows = groupedRows || [data]
                } else {
                    rows = [data]
                }
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
    }, [reservationId, groupIdParam])

    if (!reservationId && !groupIdParam) {
        return <div className="p-4 text-center">予約IDが見つかりません</div>
    }

    if (loading) {
        return <div className="p-4 text-center">予約情報を読み込み中...</div>
    }

    return (
        <div className="p-4 max-w-md mx-auto">
            <h1 className="text-xl font-bold mb-4">予約変更フォーム</h1>
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
