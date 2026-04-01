import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
    canManageTenantSettings,
    requireAdminSession,
    resolveAdminListTenantId,
} from "@/app/lib/serverAdminAuth"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const DEFAULT_MENUS: {
    slug: string
    label: string
    price: number
    sort_order: number
}[] = [
    { slug: "size_s", label: "洗車 Sサイズ", price: 8000, sort_order: 10 },
    { slug: "size_m", label: "洗車 Mサイズ", price: 9000, sort_order: 20 },
    { slug: "size_l", label: "洗車 Lサイズ", price: 10000, sort_order: 30 },
    { slug: "interior_addon", label: "内装清掃オプション", price: 3000, sort_order: 40 },
]

/** 不足している標準メニュー行だけ INSERT（既存の料金は上書きしない） */
export async function POST(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "メニューを編集する権限がありません" }, { status: 403 })
    }

    const { data: existing, error: selErr } = await supabase
        .from("service_menu_items")
        .select("slug")
        .eq("tenant_id", tenantId)

    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })

    const have = new Set((existing || []).map((r) => r.slug))
    const toInsert = DEFAULT_MENUS.filter((r) => !have.has(r.slug)).map((r) => ({
        tenant_id: tenantId,
        ...r,
        active: true,
    }))

    if (toInsert.length === 0) {
        return NextResponse.json({ ok: true, inserted: 0, message: "標準メニューはすでに登録済みです" })
    }

    const { error } = await supabase.from("service_menu_items").insert(toInsert)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, inserted: toInsert.length })
}
