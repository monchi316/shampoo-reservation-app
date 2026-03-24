"use client"

export default function CalendarSelect({ setStep, formData, setFormData }: any) {
    return (
        <div>
            <h2 className="text-xl font-bold mb-4">日時を選択</h2>

            <input
                type="date"
                value={formData.date}
                className="border p-2 w-full mb-2"
                onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                }
            />

            <input
                type="time"
                value={formData.time}
                className="border p-2 w-full mb-4"
                onChange={(e) =>
                    setFormData({ ...formData, time: e.target.value })
                }
            />

            <button
                onClick={() => setStep(3)}
                className="bg-blue-500 text-white px-4 py-2 w-full"
            >
                住所入力へ
            </button>
        </div>
    )
}