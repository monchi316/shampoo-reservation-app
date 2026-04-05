import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
    canManageTenantSettings,
    requireAdminSession,
    resolveAdminListTenantId,
} from "@/app/lib/serverAdminAuth"
import {
    defaultFeaturePayload,
    FEATURE_VEHICLE_COLOR_PLATE,
    getTenantFeatureMap,
    mergeFeaturePayload,
} from "@/app/lib/tenantFeatures"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "店舗設定の変更権限がありません" }, { status: 403 })
    }

    const map = await getTenantFeatureMap(supabase, tenantId)
    const defaults = defaultFeaturePayload()
    return NextResponse.json({
        tenantId,
        flags: {
            ...defaults,
            [FEATURE_VEHICLE_COLOR_PLATE]: map[FEATURE_VEHICLE_COLOR_PLATE] === true,
        },
    })
}

export async function PUT(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const explicit = typeof body?.tenantId === "string" ? body.tenantId : null
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "店舗設定の変更権限がありません" }, { status: 403 })
    }

    const { patch, invalid } = mergeFeaturePayload(body?.flags as Record<string, unknown> | undefined)
    if (invalid.length > 0) {
        return NextResponse.json({ error: "flags の型が不正です（boolean のみ）" }, { status: 400 })
    }
    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "更新するフラグがありません" }, { status: 400 })
    }

    const rows = Object.entries(patch).map(([feature_key, enabled]) => ({
        tenant_id: tenantId,
        feature_key,
        enabled,
    }))

    const { error } = await supabase.from("tenant_feature_flags").upsert(rows, {
        onConflict: "tenant_id,feature_key",
    })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const map = await getTenantFeatureMap(supabase, tenantId)
    const defaults = defaultFeaturePayload()
    return NextResponse.json({
        ok: true,
        tenantId,
        flags: {
            ...defaults,
            [FEATURE_VEHICLE_COLOR_PLATE]: map[FEATURE_VEHICLE_COLOR_PLATE] === true,
        },
    })
}
