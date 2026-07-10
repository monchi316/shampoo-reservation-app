"use client"

import type { ReactNode } from "react"

export function ScrollToDemoCtaButton({
    targetId,
    className,
    children,
}: {
    targetId: string
    className?: string
    children: ReactNode
}) {
    return (
        <button
            type="button"
            className={className}
            onClick={() => {
                document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
            }}
        >
            {children}
        </button>
    )
}
