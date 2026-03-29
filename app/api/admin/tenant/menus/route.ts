import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    const tenantId = req.nextUrl.searchParams.get("tenantId") || DEFAULT_TENANT_ID
    const { data, error } = await supabase
        .from("service_menu_items")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
}

export async function POST(req: NextRequest) {
    const tenantId = DEFAULT_TENANT_ID
    const body = await req.json().catch(() => ({}))
    const slug = String(body?.slug || "").trim()
    const label = String(body?.label || "").trim()
    const price = Number(body?.price)
    const sort_order = body?.sort_order != null ? Number(body.sort_order) : 0

    if (!slug || !/^[a-z0-9_]+$/.test(slug)) {
        return NextResponse.json({ error: "slug は英小文字・数字・アンダースコアのみ" }, { status: 400 })
    }
    if (!label) return NextResponse.json({ error: "label が必要です" }, { status: 400 })
    if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "price が不正です" }, { status: 400 })
    }

    const { data, error } = await supabase
        .from("service_menu_items")
        .insert({
            tenant_id: tenantId,
            slug,
            label,
            price,
            sort_order,
            active: body?.active !== false,
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
}
