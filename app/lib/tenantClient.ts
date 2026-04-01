"use client"

export const TENANT_STORAGE_KEY = "tenant_context_v1"

export type TenantContext = {
    tenantId: string
    liffId: string | null
}

type TenantStorageShape = {
    tenantId?: unknown
    liffId?: unknown
}

const FALLBACK_TENANT_ID =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID) ||
    "00000000-0000-4000-8000-000000000001"

const FALLBACK_LIFF_ID =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_LIFF_ID) || null

function parseTenantContext(raw: string | null): TenantContext | null {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as TenantStorageShape
        if (typeof parsed?.tenantId !== "string" || parsed.tenantId.length === 0) return null
        return {
            tenantId: parsed.tenantId,
            liffId: typeof parsed?.liffId === "string" && parsed.liffId.length > 0 ? parsed.liffId : null,
        }
    } catch {
        return null
    }
}

export function getTenantContextFromStorage(): TenantContext | null {
    if (typeof window === "undefined") return null
    // LINEログインのOAuthリダイレクト後、sessionStorage が消える環境があるため localStorage にもミラーする。
    return (
        parseTenantContext(window.sessionStorage.getItem(TENANT_STORAGE_KEY)) ||
        parseTenantContext(window.localStorage.getItem(TENANT_STORAGE_KEY))
    )
}

export function setTenantContextToStorage(ctx: TenantContext) {
    if (typeof window === "undefined") return
    const payload = JSON.stringify(ctx)
    window.sessionStorage.setItem(TENANT_STORAGE_KEY, payload)
    window.localStorage.setItem(TENANT_STORAGE_KEY, payload)
}

export function resolveTenantContextFromUrl(): { tenantIdHint: string; liffId: string | null } {
    if (typeof window === "undefined") {
        return { tenantIdHint: FALLBACK_TENANT_ID, liffId: FALLBACK_LIFF_ID }
    }
    const sp = new URLSearchParams(window.location.search)
    const tenantIdFromQuery = sp.get("tenantId")
    const liffIdFromQuery = sp.get("lid")
    return {
        tenantIdHint: tenantIdFromQuery || FALLBACK_TENANT_ID,
        liffId: liffIdFromQuery || FALLBACK_LIFF_ID,
    }
}

export function buildTenantQueryParam(tenantId: string): string {
    return `tenantId=${encodeURIComponent(tenantId)}`
}
