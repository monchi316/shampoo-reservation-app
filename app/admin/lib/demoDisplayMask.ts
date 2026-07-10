/** Demo店舗だけで表示名をマスクする（他店舗は絶対にマスクしない） */
const DEMO_TENANT_ID = "df67e437-4e95-4792-ad5f-8a7b1266ed4a"

export function isDemoTenantForAdmin(tenantId: string | null | undefined): boolean {
    return !!tenantId && tenantId === DEMO_TENANT_ID
}

export function maskNameForAdminDemo(
    tenantId: string | null | undefined,
    rawName: string | null | undefined,
    fallback = "名前未登録"
): string {
    if (isDemoTenantForAdmin(tenantId)) return "SUKIMA"
    const s = String(rawName || "").trim()
    return s.length > 0 ? s : fallback
}
