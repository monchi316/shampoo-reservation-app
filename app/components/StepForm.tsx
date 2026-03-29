"use client"

import CarOption from './CarOption'
import CalendarSelect from './CalendarSelect'
import AddressMap from './AddressMap'
import PriceSummary from './PriceSummary'

export default function StepForm({
    step,
    setStep,
    formData,
    setFormData,
    mode = "create",
    reservationId,
    targetUserId,
    targetUserName,
    targetGroupId,
}: any) {
    const steps = [
        { id: 1, label: "車両" },
        { id: 2, label: "日時" },
        { id: 3, label: "住所" },
        { id: 4, label: "確認" },
    ]

    return (
        <div>
            <div className="mb-6 grid grid-cols-4 gap-2">
                {steps.map((s) => {
                    const active = step === s.id
                    const done = step > s.id
                    return (
                        <div key={s.id} className="text-center">
                            <div
                                className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                                    active
                                        ? "bg-indigo-600 text-white"
                                        : done
                                          ? "bg-indigo-100 text-indigo-700"
                                          : "bg-slate-100 text-slate-500"
                                }`}
                            >
                                {s.id}
                            </div>
                            <p className={`text-xs ${active ? "text-slate-900" : "text-slate-500"}`}>
                                {s.label}
                            </p>
                        </div>
                    )
                })}
            </div>

            {/* Step 1: car info */}
            {step === 1 && (
                <CarOption
                    setStep={setStep}
                    formData={formData}
                    setFormData={setFormData}
                />
            )}

            {/* Step 2: date/time */}
            {step === 2 && (
                <CalendarSelect
                    setStep={setStep}
                    formData={formData}
                    setFormData={setFormData}
                    mode={mode}
                    reservationId={reservationId}
                    excludeGroupId={targetGroupId}
                />
            )}

            {/* Step 3: address */}
            {step === 3 && (
                <AddressMap
                    setStep={setStep}
                    formData={formData}
                    setFormData={setFormData}
                />
            )}

            {/* Step 4: final confirm (create/update) */}
            {step === 4 && (
                <PriceSummary
                    formData={formData}
                    mode={mode}
                    reservationId={reservationId}
                    targetUserId={targetUserId}
                    targetUserName={targetUserName}
                    targetGroupId={targetGroupId}
                />
            )}
        </div>
    )
}