"use client"

export default function AddressMap({ setStep, formData, setFormData }: any) {
    const getAddressByType = (type: 'home' | 'work' | 'other') => {
        if (type === 'work') return formData.workAddress || ''
        if (type === 'other') return formData.otherAddress || ''
        return formData.homeAddress || ''
    }

    return (
        <div>
            {/* 3ステップ目: 洗車場所（住所）を入力する画面 */}
            <h2 className="mb-4 text-xl font-bold text-slate-900">洗車場所</h2>

            <select
                value={formData.addressType}
                onChange={(e) => {
                    const nextType = e.target.value as 'home' | 'work' | 'other'
                    setFormData({
                        ...formData,
                        addressType: nextType,
                        // 区分切替時は、その区分の最新住所で補完する
                        address: getAddressByType(nextType),
                    })
                }}
                className="mb-2 w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none ring-indigo-100 transition focus:border-indigo-500 focus:ring-4"
            >
                <option value="home">自宅</option>
                <option value="work">職場</option>
                <option value="other">その他</option>
            </select>

            <input
                placeholder="住所"
                value={formData.address}
                onChange={(e) => {
                    const value = e.target.value
                    setFormData({
                        ...formData,
                        address: value,
                        // 現在選択中の区分の最新住所として保持
                        homeAddress: formData.addressType === 'home' ? value : (formData.homeAddress || ''),
                        workAddress: formData.addressType === 'work' ? value : (formData.workAddress || ''),
                        otherAddress: formData.addressType === 'other' ? value : (formData.otherAddress || ''),
                    })
                }}
                className="mb-4 w-full rounded-lg border border-slate-300 bg-white p-2.5 outline-none ring-indigo-100 transition focus:border-indigo-500 focus:ring-4"
            />

            <iframe
                width="100%"
                height="200"
                loading="lazy"
                className="rounded-xl border border-slate-200"
                // 住所入力に合わせてGoogleマップ埋め込みURLを作る。
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                    formData.address || ""
                )}&output=embed`}
            />

            <button
                onClick={() => setStep(4)}
                className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-700"
            >
                {/* 最終確認ステップへ */}
                確認へ
            </button>
        </div>
    )
}