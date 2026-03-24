'use client'

import { useState } from 'react'
import StepForm from '../components/StepForm'

export type FormData = {
    maker: string
    model: string
    size: string
    interior: boolean
    date: string
    time: string
    address: string
}

export default function ReservePage() {
    const [step, setStep] = useState(1)

    const [formData, setFormData] = useState<FormData>({
        maker: '',
        model: '',
        size: '',
        interior: false,
        date: '',
        time: '',
        address: '',
    })

    return (
        <div className="p-4 max-w-md mx-auto">
            <StepForm
                step={step}
                setStep={setStep}
                formData={formData}
                setFormData={setFormData}
            />
        </div>
    )
}