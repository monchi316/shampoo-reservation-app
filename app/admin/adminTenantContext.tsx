"use client"

import { createContext, useContext } from "react"

export type AdminTenantOption = { id: string; name: string }

export type AdminOperatorRole = "superadmin" | "owner" | "staff"

export const AdminTenantContext = createContext<{
    tenantId: string | null
    tenants: AdminTenantOption[]
    setTenantId: (id: string) => void
    ready: boolean
    operatorRole: AdminOperatorRole | null
    /** 店舗設定・メニュー・スタッフ登録など */
    canManageSettings: boolean
} | null>(null)

export function useAdminTenant() {
    const c = useContext(AdminTenantContext)
    if (!c) {
        throw new Error("useAdminTenant は AdminTenantProvider 内でのみ使えます")
    }
    return c
}
