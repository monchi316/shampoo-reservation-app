"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import StepForm from "../components/StepForm"
import LiffInit from "../components/LiffInit"
import { supabase } from "../lib/supabase"

type FormData = {
    maker: string
    model: string
    size: string
    interior: boolean
    date: string
    time: string
    address: string
    isManualCar: boolean
}

export default function EditReservationPage() {
    const searchParams = useSearchParams()
    const reservationId = searchParams.get("id")
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(true)
    const [targetUserId, setTargetUserId] = useState<string>("")
    const [formData, setFormData] = useState<FormData>({
        maker: "",
        model: "",
        size: "",
        interior: false,
        date: "",
        time: "",
        address: "",
        isManualCar: false,
    })

    useEffect(() => {
        const fetchReservation = async () => {
            if (!reservationId) {
                setLoading(false)
                return
            }
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

            setTargetUserId(data.user_id || "")
            setFormData({
                maker: data.maker || "",
                model: data.model || "",
                size: data.size || "",
                interior: !!data.interior,
                date: data.date || "",
                time: data.time || "",
                address: data.address || "",
                isManualCar: false,
            })
            setLoading(false)
        }

        fetchReservation()
    }, [reservationId])

    if (!reservationId) {
        return <div className="p-4 text-center">予約IDが見つかりません</div>
    }

    if (loading) {
        return <div className="p-4 text-center">予約情報を読み込み中...</div>
    }

    return (
        <div className="p-4 max-w-md mx-auto">
            <LiffInit />
            <h1 className="text-xl font-bold mb-4">予約変更フォーム</h1>
            <StepForm
                step={step}
                setStep={setStep}
                formData={formData}
                setFormData={setFormData}
                mode="update"
                reservationId={reservationId}
                targetUserId={targetUserId}
            />
        </div>
    )
}
