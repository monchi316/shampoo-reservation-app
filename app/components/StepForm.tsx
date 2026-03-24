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
}: any) {
    return (
        <div>
            {step === 1 && (
                <CarOption
                    setStep={setStep}
                    formData={formData}
                    setFormData={setFormData}
                />
            )}

            {step === 2 && (
                <CalendarSelect
                    setStep={setStep}
                    formData={formData}
                    setFormData={setFormData}
                />
            )}

            {step === 3 && (
                <AddressMap
                    setStep={setStep}
                    formData={formData}
                    setFormData={setFormData}
                />
            )}

            {step === 4 && (
                <PriceSummary
                    formData={formData}
                />
            )}
        </div>
    )
}