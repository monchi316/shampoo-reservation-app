import type { SupabaseClient } from "@supabase/supabase-js"

export function normalizeTenantId(value: unknown): string | null {
    if (typeof value !== "string") return null
    const v = value.trim()
    return v.length > 0 ? v : null
}

export async function ensureTenantExists(supabase: SupabaseClient, tenantId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from("tenants")
        .select("id")
        .eq("id", tenantId)
        .maybeSingle()
    if (error) return false
    return !!data?.id
}

export async function resolveTenantIdByLiffId(
    supabase: SupabaseClient,
    liffId: string
): Promise<{ tenantId: string } | { error: string; status: number }> {
    const lid = liffId.trim()
    if (!lid) return { error: "liffId が必要です", status: 400 }

    const { data, error } = await supabase
        .from("tenant_channels")
        .select("tenant_id, is_active")
        .eq("liff_id", lid)
        .maybeSingle()

    if (error) {
        const code = (error as { code?: string } | null)?.code
        if (code === "42P01") {
            return { error: "tenant_channels テーブルが未作成です", status: 500 }
        }
        return { error: error.message, status: 500 }
    }
    if (!data || data.is_active === false || typeof data.tenant_id !== "string") {
        return { error: "この LIFF は未登録です", status: 404 }
    }
    return { tenantId: data.tenant_id }
}
