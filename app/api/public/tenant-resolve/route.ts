import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"
import { ensureTenantExists, normalizeTenantId, resolveTenantIdByLiffId } from "@/app/lib/serverTenantResolver"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * tenant 解決 API
 * - ?lid=LIFF_ID があれば tenant_channels で tenant_id を解決
 * - なければ ?tenantId=... / DEFAULT_TENANT_ID を検証して返す
 */
export async function GET(req: NextRequest) {
    const lid = (req.nextUrl.searchParams.get("lid") || "").trim()
    if (lid) {
        const resolved = await resolveTenantIdByLiffId(supabase, lid)
        if ("error" in resolved) {
            return NextResponse.json({ error: resolved.error }, { status: resolved.status })
        }
        return NextResponse.json({
            ok: true,
            tenantId: resolved.tenantId,
            liffId: lid,
        })
    }

    const tenantId = normalizeTenantId(req.nextUrl.searchParams.get("tenantId")) || DEFAULT_TENANT_ID
    const exists = await ensureTenantExists(supabase, tenantId)
    if (!exists) {
        return NextResponse.json({ error: "tenant が見つかりません" }, { status: 404 })
    }
    return NextResponse.json({
        ok: true,
        tenantId,
        liffId: null,
    })
}
