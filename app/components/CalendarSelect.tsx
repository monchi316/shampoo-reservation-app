"use client"

export default function CalendarSelect({ setStep, formData, setFormData }: any) {
    return (
        <div>
            {/* 2ステップ目: 日付と時間を入力する画面 */}
            <h2 className="mb-4 text-xl font-bold text-slate-900">日時を選択</h2>

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
                onClick={() => setStep(3)}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-700"
            >
                {/* 次のステップ（住所入力）へ */}
                住所入力へ
            </button>
        </div>
    )
}