 "use client"

import { useState } from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

export default function ReserveForm() {

    const [selectedDate, setSelectedDate] = useState<Date>()
    const [time, setTime] = useState("")

    const timeSlots = [
        "09:00",
        "10:00",
        "11:00",
        "13:00",
        "14:00",
        "15:00"
    ]

    return (

        <div className="min-h-screen bg-gray-100 flex items-center justify-center">

            <div className="bg-white shadow-2xl rounded-2xl p-10 w-[500px]">

                <h1 className="text-3xl font-bold text-center mb-6">
                    🚗 出張洗車予約
                </h1>

                <div className="space-y-6">

                    <div>

                        <h2 className="font-bold mb-2">
                            予約日
                        </h2>

                        <DayPicker
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                        />

                    </div>

                    <div>

                        <h2 className="font-bold mb-2">
                            予約時間
                        </h2>

                        <div className="grid grid-cols-3 gap-2">

                            {timeSlots.map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTime(t)}
                                    className={`p-2 rounded border

${time === t
                                            ? "bg-blue-600 text-white"
                                            : "bg-white hover:bg-gray-100"
                                        }

`}
                                >

                                    {t}

                                </button>
                            ))}

                        </div>

                    </div>

                    <button className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700">

                        予約する

                    </button>

                </div>

            </div>

        </div>

    )
}

