import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"
import { ensureTenantExists, normalizeTenantId } from "@/app/lib/serverTenantResolver"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * 予約フォーム用の車種マスタ。
 * ブラウザの anon では `cars` の RLS で読めない環境があるため、公開 API 経由で service_role 取得する。
 */
export async function GET(req: NextRequest) {
    const tenantId = normalizeTenantId(req.nextUrl.searchParams.get("tenantId")) || DEFAULT_TENANT_ID
    const exists = await ensureTenantExists(supabase, tenantId)
    if (!exists) {
        return NextResponse.json({ error: "tenant が見つかりません" }, { status: 404 })
    }

    // Supabase/PostgREST の既定上限（例: 1000件）に引っかからないよう全件をページング取得する。
    const pageSize = 1000
    let from = 0
    const allCars: Array<{ maker: string; model: string; size: string }> = []

    for (;;) {
        const to = from + pageSize - 1
        const { data, error } = await supabase
            .from("cars")
            .select("maker, model, size")
            .order("maker", { ascending: true })
            .order("model", { ascending: true })
            .range(from, to)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const rows = (data ?? []) as Array<{ maker: string; model: string; size: string }>
        allCars.push(...rows)

        if (rows.length < pageSize) break
        from += pageSize
    }

    return NextResponse.json({ cars: allCars })
}
