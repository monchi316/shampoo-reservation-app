import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"
import { ensureTenantExists, normalizeTenantId } from "@/app/lib/serverTenantResolver"
import {
    defaultFeaturePayload,
    FEATURE_VEHICLE_COLOR_PLATE,
    getTenantFeatureMap,
} from "@/app/lib/tenantFeatures"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isMissingLogoColumn(error: unknown) {
    const e = error as { code?: string; message?: string } | null
    return e?.code === "42703" || (e?.message || "").includes("logo_path")
}

const BUCKET = "tenant-logos"

async function resolveLogoUrl(path: string) {
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)
    if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl || null
}

/** 予約フォーム用: メニュー料金・テナントID（将来ログインと連携） */
export async function GET(req: NextRequest) {
    const tenantId = normalizeTenantId(req.nextUrl.searchParams.get("tenantId")) || DEFAULT_TENANT_ID
    const exists = await ensureTenantExists(supabase, tenantId)
    if (!exists) {
        return NextResponse.json({ error: "tenant が見つかりません" }, { status: 404 })
    }

    const { data: menus, error: mErr } = await supabase
        .from("service_menu_items")
        .select("id, slug, label, price, sort_order, active")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true })

    if (mErr) {
        return NextResponse.json({ error: mErr.message }, { status: 500 })
    }

    const { data: sched } = await supabase
        .from("tenant_scheduling_settings")
        .select(
            "avg_service_minutes_per_car, avg_travel_minutes, business_hours_mode, uniform_open, uniform_close"
        )
        .eq("tenant_id", tenantId)
        .maybeSingle()

    const { data: tenantRow, error: tErr } = await supabase
        .from("tenants")
        .select("logo_path")
        .eq("id", tenantId)
        .maybeSingle()

    if (tErr && !isMissingLogoColumn(tErr)) {
        return NextResponse.json({ error: tErr.message }, { status: 500 })
    }

    const logoPath = tenantRow?.logo_path as string | null | undefined
    const logoUrl = logoPath ? await resolveLogoUrl(logoPath) : null

    const featureMap = await getTenantFeatureMap(supabase, tenantId)
    const featureDefaults = defaultFeaturePayload()

    return NextResponse.json({
        tenantId,
        menus: menus || [],
        logoUrl,
        scheduling: sched || null,
        features: {
            ...featureDefaults,
            [FEATURE_VEHICLE_COLOR_PLATE]: featureMap[FEATURE_VEHICLE_COLOR_PLATE] === true,
        },
    })
}
