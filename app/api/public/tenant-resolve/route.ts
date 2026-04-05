import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"
import { ensureTenantExists, normalizeTenantId, resolveTenantIdByLiffId } from "@/app/lib/serverTenantResolver"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function liffIdForTenantLineChannel(tenantId: string): Promise<string | null> {
    const { data: chRows, error: chErr } = await supabase
        .from("tenant_channels")
        .select("liff_id")
        .eq("tenant_id", tenantId)
        .eq("channel_type", "line_liff")
        .order("updated_at", { ascending: false })
        .limit(1)
    if (chErr || !Array.isArray(chRows) || chRows.length === 0) return null
    const raw = chRows[0]?.liff_id
    if (typeof raw !== "string" || raw.trim().length === 0) return null
    return raw.trim()
}

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
            // URL に tenantId もあるのに lid が DB と一致しない（表記ゆれ・別環境の DB など）ときの救済
            const tenantIdParam = normalizeTenantId(req.nextUrl.searchParams.get("tenantId"))
            if (tenantIdParam) {
                const exists = await ensureTenantExists(supabase, tenantIdParam)
                if (exists) {
                    const liffFromDb = await liffIdForTenantLineChannel(tenantIdParam)
                    if (liffFromDb) {
                        return NextResponse.json({
                            ok: true,
                            tenantId: tenantIdParam,
                            liffId: liffFromDb,
                            resolveNote:
                                "lid が tenant_channels と一致しなかったため tenantId で解決しました。Supabase の liff_id を URL の LIFF ID と揃えてください。",
                        })
                    }
                }
            }
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

    const liffIdFromDb = await liffIdForTenantLineChannel(tenantId)

    return NextResponse.json({
        ok: true,
        tenantId,
        liffId: liffIdFromDb,
    })
}
