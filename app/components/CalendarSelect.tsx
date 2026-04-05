"use client"

import { useEffect, useMemo, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { getTenantContextFromStorage } from "../lib/tenantClient"

type CarDraft = {
    maker?: string
    model?: string
    size?: string
}

type ReservationDraft = {
    date?: string
    time?: string
    cars?: CarDraft[]
}

type Props = {
    setStep: (step: number) => void
    formData: ReservationDraft
    setFormData: Dispatch<SetStateAction<ReservationDraft>>
    mode: "create" | "update" | string
    reservationId?: string | null
    excludeGroupId?: string | null
}

export default function CalendarSelect({
    setStep,
    formData,
    setFormData,
    mode,
    reservationId,
    excludeGroupId,
}: Props) {
    const [checking, setChecking] = useState(false)
    const [loadingCandidates, setLoadingCandidates] = useState(false)
    const [candidateTimes, setCandidateTimes] = useState<string[]>([])
    const [candidateError, setCandidateError] = useState<string | null>(null)
    const [candidateHint, setCandidateHint] = useState<string | null>(null)

    const carsCount = useMemo(
        () => (formData.cars || []).filter((c) => c.maker && c.model && c.size).length,
        [formData.cars]
    )

    useEffect(() => {
        const loadCandidates = async () => {
            setCandidateTimes([])
            setCandidateError(null)
            setCandidateHint(null)
            if (!formData.date || carsCount < 1) return
            const tenantCtx = getTenantContextFromStorage()
            if (!tenantCtx?.tenantId) return

            setLoadingCandidates(true)
            try {
                const fetchCandidates = async (numCars: number) => {
                    const sp = new URLSearchParams({
                        date: formData.date as string,
                        numCars: String(numCars),
                        tenantId: tenantCtx.tenantId,
                    })
                    if (mode === "update" && excludeGroupId) {
                        sp.set("excludeGroupId", excludeGroupId)
                    } else if (mode === "update" && reservationId) {
                        sp.set("excludeReservationIds", String(reservationId))
                    }
                    const res = await fetch(`/api/public/availability-check?${sp.toString()}`)
                    const json = await res.json().catch(() => ({}))
                    return { res, json }
                }

                const { res, json } = await fetchCandidates(carsCount)
                if (!res.ok) {
                    setCandidateError(json?.error || "空き時間候補の取得に失敗しました。")
                    return
                }
                if (!json?.ok) {
                    setCandidateError(json?.reason || "この日の候補がありません。")
                    return
                }
                const times = Array.isArray(json?.times) ? json.times : []
                setCandidateTimes(times)

                if (times.length === 0) {
                    setCandidateError(
                        json?.reason || "予約枠に空きがありません。別日または台数の調整をご検討ください。"
                    )
                    let reducedHint: string | null = null
                    if (carsCount > 1) {
                        for (let n = carsCount - 1; n >= 1; n--) {
                            const reduced = await fetchCandidates(n)
                            if (reduced.res.ok && reduced.json?.ok) {
                                const reducedTimes = Array.isArray(reduced.json?.times)
                                    ? reduced.json.times
                                    : []
                                if (reducedTimes.length > 0) {
                                    reducedHint = `${carsCount}台では空きがありません。${n}台なら予約可能です（例: ${reducedTimes
                                        .slice(0, 3)
                                        .join(" / ")}）。`
                                    break
                                }
                            }
                        }
                    }

                    if (!reducedHint) {
                        if (
                            typeof json?.earliestStartDate === "string" &&
                            typeof json?.earliestStartTime === "string" &&
                            json.earliestStartDate &&
                            json.earliestStartTime
                        ) {
                            reducedHint = `最短は ${json.earliestStartDate} ${json.earliestStartTime} からです。`
                        } else if (
                            typeof json?.earliestStartTime === "string" &&
                            json.earliestStartTime
                        ) {
                            reducedHint = `最短は ${formData.date} ${json.earliestStartTime} からです。`
                        }
                    }
                    if (reducedHint) setCandidateHint(reducedHint)
                }
            } finally {
                setLoadingCandidates(false)
            }
        }

        void loadCandidates()
    }, [formData.date, carsCount, mode, excludeGroupId, reservationId])

    const goNext = async () => {
        if (!formData.date || !formData.time) {
            alert("日付と時間を入力してください。")
            return
        }
        if (carsCount === 0) {
            alert("先にお車情報を入力してください。")
            setStep(1)
            return
        }
        setChecking(true)
        try {
            const tenantCtx = getTenantContextFromStorage()
            if (!tenantCtx?.tenantId) {
                alert("店舗情報が見つかりません。予約画面を開き直してください。")
                return
            }
            const body: Record<string, unknown> = {
                date: formData.date,
                time: formData.time,
                numCars: carsCount,
                tenantId: tenantCtx.tenantId,
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
            <p className="mb-2 text-xs text-slate-500">
                お車の台数: {carsCount} 台
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

            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-800">この日の空き時間候補</p>
                {loadingCandidates ? (
                    <p className="text-sm text-slate-600">候補を確認中…</p>
                ) : candidateError ? (
                    <>
                        <p className="text-sm text-amber-700">{candidateError}</p>
                        {candidateHint ? (
                            <p className="mt-1 text-sm text-indigo-700">{candidateHint}</p>
                        ) : null}
                    </>
                ) : candidateTimes.length === 0 ? (
                    <p className="text-sm text-slate-600">
                        日付を選ぶと候補が表示されます。
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {candidateTimes.map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setFormData({ ...formData, time: t })}
                                className={`rounded-full px-3 py-1.5 text-sm font-medium ${formData.time === t
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white text-slate-800 border border-slate-300 hover:bg-slate-100"
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                )}
            </div>

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