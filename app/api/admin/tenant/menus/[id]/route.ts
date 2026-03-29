import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}
    if (body?.label != null) patch.label = String(body.label)
    if (body?.price != null) {
        const p = Number(body.price)
        if (!Number.isFinite(p) || p < 0) {
            return NextResponse.json({ error: "price が不正です" }, { status: 400 })
        }
        patch.price = p
    }
    if (body?.sort_order != null) patch.sort_order = Number(body.sort_order)
    if (body?.active != null) patch.active = !!body.active

    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "更新項目がありません" }, { status: 400 })
    }

    const { data: row, error: fetchErr } = await supabase
        .from("service_menu_items")
        .select("id, tenant_id")
        .eq("id", id)
        .single()

    if (fetchErr || !row || row.tenant_id !== DEFAULT_TENANT_ID) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { data, error } = await supabase
        .from("service_menu_items")
        .update(patch)
        .eq("id", id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    const { id } = await params
    const { data: row } = await supabase
        .from("service_menu_items")
        .select("id, tenant_id")
        .eq("id", id)
        .single()

    if (!row || row.tenant_id !== DEFAULT_TENANT_ID) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { error } = await supabase.from("service_menu_items").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
