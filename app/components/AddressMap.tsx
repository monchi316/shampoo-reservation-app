"use client"

export default function AddressMap({ setStep, formData, setFormData }: any) {
    return (
        <div>
            <h2 className="text-xl font-bold mb-4">洗車場所</h2>

            <input
                placeholder="住所"
                value={formData.address}
                onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                }
                className="border p-2 w-full mb-4"
            />

            <iframe
                width="100%"
                height="200"
                loading="lazy"
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                    formData.address || ""
                )}&output=embed`}
            />

            <button
                onClick={() => setStep(4)}
                className="bg-blue-500 text-white px-4 py-2 w-full mt-4"
            >
                確認へ
            </button>
        </div>
    )
}