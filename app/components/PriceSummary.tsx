"use client"

import { supabase } from "../lib/supabase"

export default function PriceSummary({
    formData,
    mode = "create",
    reservationId,
    targetUserId,
}: any) {
    const basePrice =
        formData.size === "S"
            ? 3000
            : formData.size === "M"
                ? 5000
                : formData.size === "L"
                    ? 7000
                    : 0

    const total = formData.interior ? basePrice + 2000 : basePrice

    const handleReserve = async () => {
        const profile = JSON.parse(localStorage.getItem("user") || "{}")
        const lineUserId = profile.userId || targetUserId

        let currentReservationId = reservationId
        if (mode === "update") {
            if (!reservationId) {
                alert("予約IDが見つかりません")
                return
            }
            const { error } = await supabase
                .from("reservations")
                .update({
                    maker: formData.maker,
                    model: formData.model,
                    size: formData.size,
                    date: formData.date,
                    time: formData.time,
                    address: formData.address,
                    interior: formData.interior,
                })
                .eq("id", reservationId)

            if (error) {
                console.error("更新エラー:", error)
                alert("更新失敗")
                return
            }
        } else {
            const { data, error } = await supabase
                .from("reservations")
                .insert([
                    {
                        user_id: lineUserId,
                        maker: formData.maker,
                        model: formData.model,
                        size: formData.size,
                        date: formData.date,
                        time: formData.time,
                        address: formData.address,
                        interior: formData.interior,
                    },
                ])
                .select()
                .single()

            if (error || !data) {
                console.error("予約エラー:", error)
                alert("予約失敗")
                return
            }
            currentReservationId = data.id
        }

        // ② 手入力の車種だけ cars に追加
        if (formData.isManualCar && formData.maker && formData.model) {
            await supabase.from("cars").upsert(
                [
                    {
                        maker: formData.maker,
                        model: formData.model,
                        size: formData.size,
                        is_manual: true,
                    },
                ],
                { onConflict: "maker,model" }
            )
        }

        // ✅ キャンセルURL（これが正解）
        const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cancel-reservation?id=${currentReservationId}`
        const editUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/edit-reservation?id=${currentReservationId}`

        // ③ LINE送信
        console.log("🔥 send-line 呼び出し前")

        const res = await fetch("/api/send-line", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId: lineUserId,
                message:
                    mode === "update"
                        ? `予約内容を変更しました🛠️

📅 日時：${formData.date} ${formData.time}
🚙 車種：${formData.maker} ${formData.model}
📍 住所：${formData.address}

変更はこちら👇
${editUrl}

キャンセルはこちら👇
${cancelUrl}
`
                        : `予約完了🚗✨

📅 日時：${formData.date} ${formData.time}
🚙 車種：${formData.maker} ${formData.model}
📍 住所：${formData.address}

変更はこちら👇
${editUrl}

キャンセルはこちら👇
${cancelUrl}
`,
            }),
        })

        const result = await res.json()
        console.log("📡 API結果:", result)

        alert(mode === "update" ? "予約を変更しました！" : "予約完了！")
    }

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">予約確認</h2>

            <p>メーカー: {formData.maker}</p>
            <p>車種: {formData.model}</p>
            <p>サイズ: {formData.size}</p>
            <p>
                日時: {formData.date} {formData.time}
            </p>
            <p>住所: {formData.address}</p>
            <p>料金: ¥{total}</p>

            <button
                onClick={handleReserve}
                className="bg-green-500 text-white px-4 py-2 w-full mt-4"
            >
                {mode === "update" ? "変更を確定する" : "予約する"}
            </button>
        </div>
    )
}