import type { SupabaseClient } from "@supabase/supabase-js"

/** 車両ごとに色（略称）・ナンバー入力を必須にする */
export const FEATURE_VEHICLE_COLOR_PLATE = "vehicle_color_plate" as const

export type TenantFeatureKey = typeof FEATURE_VEHICLE_COLOR_PLATE

const KNOWN_KEYS: TenantFeatureKey[] = [FEATURE_VEHICLE_COLOR_PLATE]

export async function getTenantFeatureMap(
    supabase: SupabaseClient,
    tenantId: string
): Promise<Record<string, boolean>> {
    const { data, error } = await supabase
        .from("tenant_feature_flags")
        .select("feature_key, enabled")
        .eq("tenant_id", tenantId)

    if (error || !data) {
        return {}
    }
    const out: Record<string, boolean> = {}
    for (const row of data) {
        const k = row.feature_key as string
        if (k) out[k] = row.enabled === true
    }
    return out
}

export function isVehicleColorPlateEnabled(features: Record<string, boolean>): boolean {
    return features[FEATURE_VEHICLE_COLOR_PLATE] === true
}

export function defaultFeaturePayload(): Record<TenantFeatureKey, boolean> {
    return { [FEATURE_VEHICLE_COLOR_PLATE]: false }
}

export function mergeFeaturePayload(body: Record<string, unknown> | null | undefined): {
    patch: Record<string, boolean>
    invalid: string[]
} {
    const patch: Record<string, boolean> = {}
    const invalid: string[] = []
    if (!body || typeof body !== "object") {
        return { patch: {}, invalid: [] }
    }
    for (const key of KNOWN_KEYS) {
        if (!(key in body)) continue
        const v = body[key]
        if (typeof v === "boolean") {
            patch[key] = v
        } else {
            invalid.push(key)
        }
    }
    return { patch, invalid }
}
