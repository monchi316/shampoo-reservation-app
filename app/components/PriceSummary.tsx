"use client"

import { supabase } from "../lib/supabase"
import liff from "@line/liff"

export default function PriceSummary({ formData }: any) {
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

        // ① 予約保存（明示的に指定🔥）
        const { data, error } = await supabase
            .from("reservations")
            .insert([
                {
                    user_id: profile.userId,
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

        const reservationId = data.id

        if (error) {
            console.error("予約エラー:", error)
            alert("予約失敗: " + error.message)
            return
        }

        // ② 車種追加
        await supabase.from("cars").upsert([
            {
                maker: formData.maker,
                model: formData.model,
                size: formData.size,
                is_manual: true,
            },
        ])

        // ③ LINE送信
        await fetch("/api/send-line", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId: profile.userId,
                message: `予約完了🚗✨

📅 日時：${formData.date} ${formData.time}
🚙 車種：${formData.maker} ${formData.model}
📍 住所：${formData.address}

キャンセルはこちら👇
https://shampoo-reservation-app.vercel.app/cancel?id=${reservationId}
`,
            }),
        })

        alert("予約完了！")
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
                予約する
            </button>
        </div>
    )
}