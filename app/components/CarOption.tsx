"use client"

// ひらがな入力をカタカナへ寄せて、候補検索しやすくする補助関数。
const toKatakana = (str: string) => {
    return str.replace(/[\u3041-\u3096]/g, (match) =>
        String.fromCharCode(match.charCodeAt(0) + 0x60)
    )
}

import { useEffect, useState } from "react"
import { buildTenantQueryParam, getTenantContextFromStorage } from "../lib/tenantClient"

export default function CarOption({
    setStep,
    formData,
    setFormData,
    tenantId: tenantIdProp,
}: any) {
    // DBから取得した車種マスタ
    const [cars, setCars] = useState<any[]>([])
    // 車種候補（maker + model）
    const [suggestions, setSuggestions] = useState<any[]>([])
    // メーカー候補
    const [makerSuggestions, setMakerSuggestions] = useState<string[]>([])
    const [optionMenus, setOptionMenus] = useState<Array<{ slug: string; label: string }>>([])
    const [vehicleColorPlateEnabled, setVehicleColorPlateEnabled] = useState(false)

    // 車種マスタ（anon 直読みは RLS で空になることがあるため /api/public/car-master 経由）
    useEffect(() => {
        const fetchCars = async () => {
            const fromProp =
                typeof tenantIdProp === "string" && tenantIdProp.trim().length > 0
                    ? tenantIdProp.trim()
                    : null
            const tenantId = fromProp || getTenantContextFromStorage()?.tenantId || null
            if (!tenantId) return

            const res = await fetch(`/api/public/car-master?${buildTenantQueryParam(tenantId)}`)
            const json = await res.json().catch(() => ({}))
            if (!res.ok) return
            const data = (Array.isArray(json?.cars) ? json.cars : []) as Array<{
                maker?: string | null
                model?: string | null
                size?: string | null
            }>
            setCars(data)
            const makers = Array.from(
                new Set(
                    data
                        .map((car) => (typeof car.maker === "string" ? car.maker : ""))
                        .filter((m) => m.length > 0)
                )
            )
            setMakerSuggestions(makers)
        }
        void fetchCars()
    }, [tenantIdProp])

    useEffect(() => {
        const loadOptions = async () => {
            const fromProp =
                typeof tenantIdProp === "string" && tenantIdProp.trim().length > 0
                    ? tenantIdProp.trim()
                    : null
            const fromStorage = getTenantContextFromStorage()?.tenantId || null
            const tenantId = fromProp || fromStorage
            if (!tenantId) return
            const res = await fetch(`/api/public/tenant-config?${buildTenantQueryParam(tenantId)}`)
            const json = await res.json().catch(() => ({}))
            if (!res.ok) return
            const options = Array.isArray(json?.menus)
                ? json.menus
                      .filter(
                          (m: any) =>
                              m?.active !== false &&
                              typeof m?.slug === "string" &&
                              typeof m?.label === "string" &&
                              !String(m.slug).startsWith("size_")
                      )
                      .map((m: any) => ({ slug: String(m.slug), label: String(m.label) }))
                : []
            setOptionMenus(options)
            setVehicleColorPlateEnabled(json?.features?.vehicle_color_plate === true)
        }
        void loadOptions()
    }, [tenantIdProp])

    const updateCarAt = (index: number, patch: any) => {
        const nextCars = [...(formData.cars || [])]
        const current = nextCars[index] || {}
        nextCars[index] = {
            ...current,
            selectedAddonSlugs: Array.isArray(current.selectedAddonSlugs) ? current.selectedAddonSlugs : [],
            vehicleColorAbbr: current.vehicleColorAbbr ?? "",
            vehiclePlate: current.vehiclePlate ?? "",
            ...patch,
        }
        const anyInterior = nextCars.some((c: any) =>
            Array.isArray(c?.selectedAddonSlugs) ? c.selectedAddonSlugs.includes("interior_addon") : false
        )
        setFormData({ ...formData, cars: nextCars, interior: anyInterior })
    }

    const addCar = () => {
        if ((formData.cars || []).length >= 3) return
        setFormData({
            ...formData,
            cars: [
                ...(formData.cars || []),
                {
                    maker: "",
                    model: "",
                    size: "",
                    isManualCar: false,
                    selectedAddonSlugs: [],
                    vehicleColorAbbr: "",
                    vehiclePlate: "",
                },
            ],
        })
    }

    const removeCar = (index: number) => {
        const nextCars = (formData.cars || []).filter((_: any, i: number) => i !== index)
        setFormData({
            ...formData,
            cars:
                nextCars.length > 0
                    ? nextCars
                    : [
                          {
                              maker: "",
                              model: "",
                              size: "",
                              isManualCar: false,
                              selectedAddonSlugs: [],
                              vehicleColorAbbr: "",
                              vehiclePlate: "",
                          },
                      ],
        })
    }

    // メーカー入力時:
    // - 車両情報を更新
    // - 入力文字でメーカー候補を絞り込み
    // - 手入力扱いにする（isManualCar = true）
    const handleMakerChange = (index: number, value: string) => {
        updateCarAt(index, { maker: value, isManualCar: true })

        const inputValue = toKatakana(value.toLowerCase())

        const filtered = cars
            .map(car => car.maker)
            .filter((maker, index, self) => self.indexOf(maker) === index) // 重複排除
            .filter((maker) =>
                toKatakana(maker.toLowerCase()).includes(inputValue)
            )

        setMakerSuggestions(filtered)
    }

    const handleModelChange = (index: number, value: string) => {
        // 車種入力時も手入力扱いにする。
        updateCarAt(index, { model: value, isManualCar: true })

        const filtered = cars.filter((car) => {
            const currentMaker = formData.cars?.[index]?.maker || ""
            const matchMaker = currentMaker
                ? car.maker.toLowerCase().includes(currentMaker.toLowerCase())
                : true

            const inputValue = toKatakana(value.toLowerCase())
            const carModel = toKatakana(car.model.toLowerCase())

            const matchModel = carModel.includes(inputValue)

            return matchMaker && matchModel
        })

        setSuggestions(filtered)
    }

    // 候補をクリックしたとき:
    // - maker/model/size を自動入力
    // - 既存車種扱いにする（isManualCar = false）
    const selectCar = (index: number, car: any) => {
        updateCarAt(index, {
            maker: car.maker,
            model: car.model,
            size: car.size,
            isManualCar: false,
            selectedAddonSlugs: Array.isArray(formData.cars?.[index]?.selectedAddonSlugs)
                ? formData.cars[index].selectedAddonSlugs
                : [],
            vehicleColorAbbr: formData.cars?.[index]?.vehicleColorAbbr ?? "",
            vehiclePlate: formData.cars?.[index]?.vehiclePlate ?? "",
        })
        setSuggestions([])
    }
    return (
        <div>
            <h2 className="mb-4 text-xl font-bold text-slate-900">お車情報</h2>
            {(formData.cars || []).map((carItem: any, index: number) => (
                <div key={index} className="mb-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="font-semibold text-slate-800">お車 {index + 1}</p>
                        {(formData.cars || []).length > 1 && (
                            <button
                                type="button"
                                onClick={() => removeCar(index)}
                                className="text-sm font-medium text-red-600 hover:text-red-700"
                            >
                                このお車を削除
                            </button>
                        )}
                    </div>

                    <input
                        placeholder="メーカー"
                        value={carItem.maker}
                        onChange={(e) => handleMakerChange(index, e.target.value)}
                        className="mb-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none ring-indigo-100 transition focus:border-indigo-500 focus:ring-4"
                    />

                    {makerSuggestions.length > 0 && carItem.maker && (
                        <ul className="mb-2 rounded-lg border border-slate-200 bg-white p-1">
                            {makerSuggestions.map((maker, i) => (
                                <li
                                    key={`${index}-${i}`}
                                    onClick={() => {
                                        updateCarAt(index, { maker, isManualCar: true })
                                        setMakerSuggestions([])
                                    }}
                                    className="cursor-pointer rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50"
                                >
                                    {maker}
                                </li>
                            ))}
                        </ul>
                    )}

                    <input
                        placeholder="車種"
                        value={carItem.model}
                        onChange={(e) => handleModelChange(index, e.target.value)}
                        className="mb-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none ring-indigo-100 transition focus:border-indigo-500 focus:ring-4"
                    />

                    {/* 車種候補一覧 */}
                    {suggestions.length > 0 && (
                        <ul className="mb-2 rounded-lg border border-slate-200 bg-white p-1">
                            {suggestions.map((car, i) => (
                                <li
                                    key={`${index}-s-${i}`}
                                    onClick={() => selectCar(index, car)}
                                    className="cursor-pointer rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50"
                                >
                                    {car.maker} {car.model}（{car.size}）
                                </li>
                            ))}
                        </ul>
                    )}

                    <select
                        value={carItem.size}
                        onChange={(e) => updateCarAt(index, { size: e.target.value })}
                        className="mb-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none ring-indigo-100 transition focus:border-indigo-500 focus:ring-4"
                    >
                        <option value="">サイズ選択</option>
                        <option value="S">S</option>
                        <option value="M">M</option>
                        <option value="L">L</option>
                    </select>

                    {vehicleColorPlateEnabled && (
                        <div className="mb-2 space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                            <p className="text-sm font-semibold text-slate-800">お車の色・ナンバー</p>
                            <input
                                placeholder="色（略称）"
                                value={carItem.vehicleColorAbbr ?? ""}
                                onChange={(e) => updateCarAt(index, { vehicleColorAbbr: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm outline-none ring-indigo-100 focus:border-indigo-500 focus:ring-4"
                            />
                            <input
                                placeholder="ナンバー（例: 品川500あ1234）"
                                value={carItem.vehiclePlate ?? ""}
                                onChange={(e) => updateCarAt(index, { vehiclePlate: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm outline-none ring-indigo-100 focus:border-indigo-500 focus:ring-4"
                            />
                        </div>
                    )}

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="mb-2 text-sm font-semibold text-slate-800">オプション</p>
                        {optionMenus.length === 0 ? (
                            <p className="text-xs text-slate-500">利用可能なオプションはありません</p>
                        ) : (
                            <div className="space-y-1">
                                {optionMenus.map((opt) => {
                                    const selected = Array.isArray(carItem.selectedAddonSlugs)
                                        ? carItem.selectedAddonSlugs.includes(opt.slug)
                                        : false
                                    return (
                                        <label key={`${index}-${opt.slug}`} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={(e) => {
                                                    const prev = Array.isArray(carItem.selectedAddonSlugs)
                                                        ? carItem.selectedAddonSlugs
                                                        : []
                                                    const next = e.target.checked
                                                        ? Array.from(new Set([...prev, opt.slug]))
                                                        : prev.filter((s: string) => s !== opt.slug)
                                                    updateCarAt(index, { selectedAddonSlugs: next })
                                                }}
                                            />
                                            {opt.label}
                                        </label>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {(formData.cars || []).length < 3 && (
                <button
                    type="button"
                    onClick={addCar}
                    className="mb-4 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                    + お車を追加（最大3台）
                </button>
            )}

            <button
                onClick={() => setStep(2)}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={
                    (formData.cars || []).some((c: any) => !c.maker || !c.model || !c.size) ||
                    (vehicleColorPlateEnabled &&
                        (formData.cars || []).some(
                            (c: any) =>
                                !String(c.vehicleColorAbbr ?? "").trim() ||
                                !String(c.vehiclePlate ?? "").trim()
                        ))
                }
            >
                日時選択へ
            </button>
        </div>
    )
}