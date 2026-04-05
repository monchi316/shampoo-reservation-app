"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { menusToPriceMap, totalForCars } from "../lib/menuPricing"
import { supabase } from "../lib/supabase"
import { buildTenantQueryParam, getTenantContextFromStorage } from "../lib/tenantClient"

const FALLBACK_MENU_PRICES: Record<string, number> = {
    size_s: 8000,
    size_m: 9000,
    size_l: 10000,
    interior_addon: 3000,
}
// 同意文書の版。規約/ポリシーを更新したら更新し、端末側の再同意を促す。
const AGREEMENT_DOC_VERSION = "20260403"
const AGREEMENT_STORAGE_KEY = `sukima_agreement_v1_${AGREEMENT_DOC_VERSION}`
const PRIVACY_URL = "/privacy"
const TERMS_URL = "/terms"

export default function PriceSummary({
    formData,
    mode = "create",
    reservationId,
    targetUserId,
    targetUserName,
    targetGroupId,
    tenantId: tenantIdProp,
}: any) {
    const cars = (formData.cars || []).filter(
        (c: any) => c.maker && c.model && c.size
    )

    const [menuPrices, setMenuPrices] = useState<Record<string, number>>(FALLBACK_MENU_PRICES)
    const [vehicleColorPlateEnabled, setVehicleColorPlateEnabled] = useState(false)
    const submittingRef = useRef(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    /** 変更フローで一度成功したら、再押下で通知が重複しないようロック（再編集は画面の再読み込み） */
    const [changeCompleted, setChangeCompleted] = useState(false)

    // 同意（この端末では省略）
    const [agreed, setAgreed] = useState(false)

    useEffect(() => {
        try {
            const v = window.localStorage.getItem(AGREEMENT_STORAGE_KEY)
            if (v === "1") setAgreed(true)
        } catch {
            // localStorage が使えない環境でも画面は動くよう握りつぶす
        }
    }, [])

    useEffect(() => {
        const fromProp =
            typeof tenantIdProp === "string" && tenantIdProp.trim().length > 0
                ? tenantIdProp.trim()
                : null
        const id = fromProp || getTenantContextFromStorage()?.tenantId
        if (!id) return
        fetch(`/api/public/tenant-config?${buildTenantQueryParam(id)}`)
            .then((r) => r.json())
            .then((j) => {
                const map = menusToPriceMap(j?.menus || [])
                if (Object.keys(map).length > 0) setMenuPrices(map)
                setVehicleColorPlateEnabled(j?.features?.vehicle_color_plate === true)
            })
            .catch(() => { })
    }, [tenantIdProp])

    const total = useMemo(() => totalForCars(cars, menuPrices), [cars, menuPrices])

    const handleReserve = async () => {
        if (!agreed) {
            alert("利用規約およびプライバシーポリシーに同意してください。")
            return
        }
        if (mode === "update" && changeCompleted) return
        if (submittingRef.current) return
        submittingRef.current = true
        setIsSubmitting(true)
        try {
        // Current LINE user (for new reservation flow).
        const profile = JSON.parse(localStorage.getItem("user") || "{}")
        const lineUserId = profile.userId || targetUserId
        const lineUserName =
            profile.name || profile.displayName || targetUserName || "お客様"

        if (!lineUserId) {
            alert("LINEユーザーIDが取得できませんでした。再ログイン後にお試しください。")
            return
        }
        const tenantCtx = getTenantContextFromStorage()
        if (!tenantCtx?.tenantId) {
            alert("店舗情報が見つかりません。予約画面を開き直してください。")
            return
        }

        const availBody: Record<string, unknown> = {
            date: formData.date,
            time: formData.time,
            numCars: cars.length,
            tenantId: tenantCtx.tenantId,
        }
        if (mode === "update" && targetGroupId) {
            availBody.excludeGroupId = targetGroupId
        } else if (mode === "update" && reservationId) {
            availBody.excludeReservationIds = [reservationId]
        }
        const avail = await fetch("/api/public/availability-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(availBody),
        })
        const availJson = await avail.json().catch(() => ({}))
        if (!availJson.ok) {
            alert(availJson.reason || "この日時は予約できません。")
            return
        }

        if (vehicleColorPlateEnabled) {
            const missing = cars.some(
                (car: { vehicleColorAbbr?: string; vehiclePlate?: string }) =>
                    !String(car.vehicleColorAbbr ?? "").trim() ||
                    !String(car.vehiclePlate ?? "").trim()
            )
            if (missing) {
                alert("各お車の色（略称）とナンバーを入力してください。")
                return
            }
        }

        const vehiclePayload = (car: {
            vehicleColorAbbr?: string
            vehiclePlate?: string
        }) => ({
            vehicle_color_abbr: String(car.vehicleColorAbbr ?? "").trim(),
            vehicle_plate: String(car.vehiclePlate ?? "").trim(),
        })

        let currentReservationId = reservationId
        let currentGroupId = targetGroupId || ""
        if (mode === "update") {
            // Update existing reservation.
            if (cars.length === 0) {
                alert("お車情報が不足しています")
                return
            }

            if (targetGroupId) {
                // グループ予約は一度削除して、最新内容で同じ group_id に再作成（RLS 回避のため API 経由）。
                const payload = cars.map((car: any) => ({
                    group_id: targetGroupId,
                    user_id: lineUserId,
                    user_name: lineUserName,
                    maker: car.maker,
                    model: car.model,
                    size: car.size,
                    date: formData.date,
                    time: formData.time,
                    address: formData.address,
                    interior: Array.isArray(car.selectedAddonSlugs)
                        ? car.selectedAddonSlugs.includes("interior_addon")
                        : false,
                    addon_slugs: Array.isArray(car.selectedAddonSlugs) ? car.selectedAddonSlugs : [],
                    ...vehiclePayload(car),
                }))

                const res = await fetch("/api/public/reservations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "replace_group",
                        group_id: targetGroupId,
                        rows: payload,
                        tenantId: tenantCtx.tenantId,
                    }),
                })
                const json = await res.json().catch(() => ({}))
                if (!res.ok || !Array.isArray(json.data) || json.data.length === 0) {
                    console.error("更新エラー:", json)
                    alert(json.error || "更新失敗")
                    return
                }
                currentReservationId = json.data[0].id
                currentGroupId = targetGroupId
            } else {
                // 旧データ（単体予約）は id 指定で更新。
                if (!reservationId) {
                    alert("予約IDが見つかりません")
                    return
                }
                const firstCar = cars[0]
                const res = await fetch("/api/public/reservations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "update_one",
                        reservation_id: reservationId,
                        tenantId: tenantCtx.tenantId,
                        fields: {
                            user_name: lineUserName,
                            maker: firstCar.maker,
                            model: firstCar.model,
                            size: firstCar.size,
                            date: formData.date,
                            time: formData.time,
                            address: formData.address,
                            interior: Array.isArray(firstCar.selectedAddonSlugs)
                                ? firstCar.selectedAddonSlugs.includes("interior_addon")
                                : false,
                            addon_slugs: Array.isArray(firstCar.selectedAddonSlugs)
                                ? firstCar.selectedAddonSlugs
                                : [],
                            ...vehiclePayload(firstCar),
                        },
                    }),
                })
                const json = await res.json().catch(() => ({}))
                if (!res.ok) {
                    console.error("更新エラー:", json)
                    alert(json.error || "更新失敗")
                    return
                }
            }
        } else {
            // Create new reservation.
            if (cars.length === 0) {
                alert("お車情報を入力してください")
                return
            }
            currentGroupId = crypto.randomUUID()
            const payload = cars.map((car: any) => ({
                group_id: currentGroupId,
                user_id: lineUserId,
                user_name: lineUserName,
                maker: car.maker,
                model: car.model,
                size: car.size,
                date: formData.date,
                time: formData.time,
                address: formData.address,
                interior: Array.isArray(car.selectedAddonSlugs)
                    ? car.selectedAddonSlugs.includes("interior_addon")
                    : false,
                addon_slugs: Array.isArray(car.selectedAddonSlugs) ? car.selectedAddonSlugs : [],
                ...vehiclePayload(car),
            }))
            const res = await fetch("/api/public/reservations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "insert", rows: payload, tenantId: tenantCtx.tenantId }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !Array.isArray(json.data) || json.data.length === 0) {
                console.error("予約エラー:", json)
                alert(json.error || "予約失敗")
                return
            }
            currentReservationId = json.data[0].id
        }

        // ユーザーマスタへ最新のよく使う情報を保存（サーバーAPI経由）
        // ここでは今回入力した車両だけで上書きせず、過去に保存済みの車両候補も維持する。
        let mergedCars = [...cars]
        try {
            const existingRes = await fetch(
                `/api/users/profile?userId=${encodeURIComponent(lineUserId)}`
            )
            if (existingRes.ok) {
                const existingJson = await existingRes.json()
                const existingCars = Array.isArray(existingJson?.data?.cars)
                    ? existingJson.data.cars
                    : []

                const normalize = (car: any) => ({
                    maker: car?.maker || "",
                    model: car?.model || "",
                    size: car?.size || "",
                    isManualCar: !!car?.isManualCar,
                    selectedAddonSlugs: Array.isArray(car?.selectedAddonSlugs)
                        ? car.selectedAddonSlugs
                        : [],
                    vehicleColorAbbr: car?.vehicleColorAbbr || car?.vehicle_color_abbr || "",
                    vehiclePlate: car?.vehiclePlate || car?.vehicle_plate || "",
                })

                const withHistory = [...cars, ...existingCars.map(normalize)]
                    .filter((car: any) => car.maker && car.model && car.size)
                    .reduce((acc: any[], car: any) => {
                        const key = `${car.maker}__${car.model}__${car.size}__${String(car.vehiclePlate || "").trim()}`
                        if (!acc.some((c) => `${c.maker}__${c.model}__${c.size}__${String(c.vehiclePlate || "").trim()}` === key)) {
                            acc.push(car)
                        }
                        return acc
                    }, [])

                mergedCars = withHistory.slice(0, 3)
            }
        } catch (e) {
            console.error("既存cars取得エラー:", e)
        }

        const carsForUserProfile = mergedCars.map((car: any) => ({
            maker: String(car?.maker ?? ""),
            model: String(car?.model ?? ""),
            size: String(car?.size ?? ""),
            isManualCar: !!car?.isManualCar,
            selectedAddonSlugs: Array.isArray(car?.selectedAddonSlugs) ? car.selectedAddonSlugs : [],
            vehicleColorAbbr: String(car?.vehicleColorAbbr ?? car?.vehicle_color_abbr ?? ""),
            vehiclePlate: String(car?.vehiclePlate ?? car?.vehicle_plate ?? ""),
        }))

        const userRes = await fetch("/api/users/profile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                user_id: lineUserId,
                user_name: lineUserName,
                maker: cars[0]?.maker || "",
                model: cars[0]?.model || "",
                size: cars[0]?.size || "",
                address: formData.address,
                cars: carsForUserProfile,
                last_address: formData.address,
                last_address_type: formData.addressType,
                home_address: formData.homeAddress || null,
                work_address: formData.workAddress || null,
                other_address: formData.otherAddress || null,
            }),
        })
        if (!userRes.ok) {
            const errBody = await userRes.json().catch(() => ({}))
            console.error("users保存エラー:", errBody)
            alert(`users保存に失敗しました: ${errBody?.error || "unknown error"}`)
            return
        }

        // 手入力車種だけ cars マスタへ追加（最大3台分）
        const manualCars = cars.filter((car: any) => car.isManualCar)
        if (manualCars.length > 0) {
            await supabase.from("cars").upsert(
                manualCars.map((car: any) => ({
                    maker: car.maker,
                    model: car.model,
                    size: car.size,
                    is_manual: true,
                })),
                { onConflict: "maker,model" }
            )
        }

        // Build action links included in LINE message.
        const tenantQuery = buildTenantQueryParam(tenantCtx.tenantId)
        const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cancel-reservation?id=${currentReservationId}&groupId=${currentGroupId}&${tenantQuery}`
        const editUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/edit-reservation?id=${currentReservationId}&groupId=${currentGroupId}&${tenantQuery}`

        // Send LINE push through server API route.

        const res = await fetch("/api/send-line", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                tenantId: tenantCtx.tenantId,
                userId: lineUserId,
                kind: mode === "update" ? "reservation_updated" : "reservation_created",
                reservationGroupId: currentGroupId || null,
                message:
                    mode === "update"
                        ? `予約内容を変更しました🛠️

👤 お名前：${lineUserName}
📅 日時：${formData.date} ${formData.time}
🚙 車種：
${cars.map((car: any, i: number) => `${i + 1}. ${car.maker} ${car.model}（${car.size}）`).join("\n")}
📍 住所：${formData.address}

変更はこちら👇
${editUrl}

キャンセルはこちら👇
${cancelUrl}
`
                        : `予約完了🚗✨

👤 お名前：${lineUserName}
📅 日時：${formData.date} ${formData.time}
🚙 車種：
${cars.map((car: any, i: number) => `${i + 1}. ${car.maker} ${car.model}（${car.size}）`).join("\n")}
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

        if (mode === "update") {
            setChangeCompleted(true)
        }
        alert(mode === "update" ? "予約を変更しました！" : "予約完了！")
        } finally {
            submittingRef.current = false
            setIsSubmitting(false)
        }
    }

    return (
        <div>
            <h2 className="mb-4 text-xl font-bold text-slate-900">予約確認</h2>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <p className="mb-2 font-semibold text-slate-800">お車一覧</p>
                {cars.map((car: any, i: number) => (
                    <p key={i} className="text-sm text-slate-700">
                        {i + 1}. {car.maker} {car.model}（{car.size}）
                    </p>
                ))}
            </div>
            <p className="text-slate-700">
                日時: {formData.date} {formData.time}
            </p>
            <p className="text-slate-700">住所: {formData.address}</p>
            <p className="text-slate-700">
                住所区分:
                {formData.addressType === "home"
                    ? "自宅"
                    : formData.addressType === "work"
                        ? "職場"
                        : "その他"}
            </p>
            <p className="mt-2 text-lg font-bold text-indigo-700">料金: ¥{total.toLocaleString()}</p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4 text-sm">
                <label className="flex cursor-pointer items-start gap-2">
                    <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => {
                            const next = e.target.checked
                            setAgreed(next)
                            if (next) {
                                try {
                                    window.localStorage.setItem(AGREEMENT_STORAGE_KEY, "1")
                                } catch {
                                    // 保存に失敗してもチェック状態だけは反映する
                                }
                            }
                        }}
                        className="mt-1 h-4 w-4 accent-indigo-600"
                    />
                    <span className="leading-relaxed">
                        私は
                        <a
                            href={TERMS_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-700 underline"
                        >
                            利用規約
                        </a>
                        および
                        <a
                            href={PRIVACY_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-700 underline"
                        >
                            プライバシーポリシー
                        </a>
                        に同意のうえ、予約します。
                    </span>
                </label>
            </div>

            <button
                type="button"
                disabled={isSubmitting || !agreed || (mode === "update" && changeCompleted)}
                onClick={handleReserve}
                className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
            >
                {isSubmitting
                    ? "処理中…"
                    : !agreed
                      ? "利用規約への同意が必要です"
                      : mode === "update" && changeCompleted
                        ? "変更を反映しました"
                        : mode === "update"
                          ? "変更を確定する"
                          : "予約する"}
            </button>
            {mode === "update" && changeCompleted && (
                <p className="mt-2 text-center text-xs text-slate-500">
                    さらに内容を変える場合は、このページを再読み込みしてください。
                </p>
            )}
        </div>
    )
}