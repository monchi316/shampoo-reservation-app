"use client"

const toKatakana = (str: string) => {
    return str.replace(/[\u3041-\u3096]/g, (match) =>
        String.fromCharCode(match.charCodeAt(0) + 0x60)
    )
}

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function CarOption({ setStep, formData, setFormData }: any) {
    const [cars, setCars] = useState<any[]>([])
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [makerSuggestions, setMakerSuggestions] = useState<string[]>([])

    // 🔽 DBから全車種取得
    useEffect(() => {
        const fetchCars = async () => {
            const { data } = await supabase.from("cars").select("*")
            setCars(data || [])
            const makers = Array.from(new Set((data || []).map(car => car.maker)))
            setCars(data || [])
            setMakerSuggestions(makers)
        }
        fetchCars()

    }, [])

    // 🔽 入力で絞り込み
    const handleMakerChange = (value: string) => {
        setFormData({ ...formData, maker: value, isManualCar: true })

        const inputValue = toKatakana(value.toLowerCase())

        const filtered = cars
            .map(car => car.maker)
            .filter((maker, index, self) => self.indexOf(maker) === index) // 重複排除
            .filter((maker) =>
                toKatakana(maker.toLowerCase()).includes(inputValue)
            )

        setMakerSuggestions(filtered)
    }

    const handleModelChange = (value: string) => {
        setFormData({ ...formData, model: value, isManualCar: true })

        const filtered = cars.filter((car) => {
            const matchMaker = formData.maker
                ? car.maker.toLowerCase().includes(formData.maker.toLowerCase())
                : true

            const inputValue = toKatakana(value.toLowerCase())
            const carModel = toKatakana(car.model.toLowerCase())

            const matchModel = carModel.includes(inputValue)

            return matchMaker && matchModel
        })

        setSuggestions(filtered)
    }

    // 🔽 候補クリック
    const selectCar = (car: any) => {
        setFormData({
            ...formData,
            maker: car.maker,
            model: car.model,
            size: car.size,
            isManualCar: false,
        })
        setSuggestions([])
    }
    return (
        <div>
            <h2 className="text-xl font-bold mb-4">車両情報</h2>

            <input
                placeholder="メーカー"
                value={formData.maker}
                onChange={(e) => handleMakerChange(e.target.value)}
                className="border p-2 w-full mb-2"
            />

            {makerSuggestions.length > 0 && formData.maker && (
                <ul>
                    {makerSuggestions.map((maker, i) => (
                        <li
                            key={i}
                            onClick={() => {
                                setFormData({ ...formData, maker, isManualCar: true })
                                setMakerSuggestions([])
                            }}
                        >
                            {maker}
                        </li>
                    ))}
                </ul>
            )}

            <input
                placeholder="車種"
                value={formData.model}
                onChange={(e) => handleModelChange(e.target.value)}
                className="border p-2 w-full mb-2"
            />

            {/* 👇 サジェスト */}
            {suggestions.length > 0 && (
                <ul>
                    {suggestions.map((car, i) => (
                        <li key={i} onClick={() => selectCar(car)}>
                            {car.maker} {car.model}（{car.size}）
                        </li>
                    ))}
                </ul>
            )}

            <select
                value={formData.size}
                onChange={(e) =>
                    setFormData({ ...formData, size: e.target.value })
                }
                className="border p-2 w-full mb-2"
            >
                <option value="">サイズ選択</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
            </select>

            <label className="block mb-4">
                <input
                    type="checkbox"
                    checked={formData.interior}
                    onChange={(e) =>
                        setFormData({ ...formData, interior: e.target.checked })
                    }
                />
                内装清掃あり
            </label>

            <button
                onClick={() => setStep(2)}
                className="bg-blue-500 text-white px-4 py-2 w-full"
            >
                日時選択へ
            </button>
        </div>
    )
}