"use client"

import { useEffect, useState } from "react"

export default function TenantLogo({ className }: { className?: string }) {
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        ;(async () => {
            try {
                const res = await fetch("/api/public/tenant-config")
                const json = await res.json().catch(() => ({}))
                if (!mounted) return
                setLogoUrl((json?.logoUrl as string | null) || null)
            } catch {
                if (!mounted) return
                setLogoUrl(null)
            } finally {
                if (!mounted) return
                setLoading(false)
            }
        })()

        return () => {
            mounted = false
        }
    }, [])

    if (loading) return null
    if (!logoUrl) return null

    return (
        <div
            className={className || "h-14 w-14 overflow-hidden rounded-md bg-white"}
            aria-label="tenant logo"
        >
            <img src={logoUrl} alt="企業ロゴ" className="h-full w-full object-contain" />
        </div>
    )
}

