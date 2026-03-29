"use client"

import { useState } from "react"

const CLIENT_DEFAULT_TENANT_ID =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID) ||
    "00000000-0000-4000-8000-000000000001"

export default function CalendarSelect({
    setStep,
    formData,
    setFormData,
    mode,
    reservationId,
    excludeGroupId,
}: any) {
    const [checking, setChecking] = useState(false)

    const goNext = async () => {
        const cars = (formData.cars || []).filter((c: any) => c.maker && c.model && c.size)
        if (!formData.date || !formData.time) {
            alert("日付と時間を入力してください。")
            return
        }
        if (cars.length === 0) {
            alert("先に車両情報を入力してください。")
            setStep(1)
            return
        }
        setChecking(true)
        try {
            const body: Record<string, unknown> = {
                date: formData.date,
                time: formData.time,
                numCars: cars.length,
                tenantId: CLIENT_DEFAULT_TENANT_ID,
            }
            if (mode === "update" && excludeGroupId) {
                body.excludeGroupId = excludeGroupId
            } else if (mode === "update" && reservationId) {
                body.excludeReservationIds = [reservationId]
            }
            const res = await fetch("/api/public/availability-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const json = await res.json().catch(() => ({}))
            if (!json.ok) {
                alert(json.reason || "この日時は予約できません。別の時間を選んでください。")
                return
            }
            setStep(3)
        } finally {
            setChecking(false)
        }
    }

    return (
        <div>
            {/* 2ステップ目: 日付と時間を入力する画面 */}
            <h2 className="mb-4 text-xl font-bold text-slate-900">日時を選択</h2>
            <p className="mb-3 text-sm text-slate-600">
                営業時間と既存予約・移動時間を考慮し、この日時で予約可能か確認してから次へ進みます。
            </p>

            <input
                type="date"
                value={formData.date}
                className="mb-3 w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none ring-indigo-100 transition focus:border-indigo-500 focus:ring-4"
                onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                }
            />

            <input
                type="time"
                value={formData.time}
                className="mb-4 w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none ring-indigo-100 transition focus:border-indigo-500 focus:ring-4"
                onChange={(e) =>
                    setFormData({ ...formData, time: e.target.value })
                }
            />

            <button
                type="button"
                disabled={checking}
                onClick={goNext}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
                {checking ? "確認中…" : "住所入力へ"}
            </button>
        </div>
    )
}