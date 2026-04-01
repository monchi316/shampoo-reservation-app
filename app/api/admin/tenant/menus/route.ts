import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
    canManageTenantSettings,
    requireAdminSession,
    resolveAdminListTenantId,
} from "@/app/lib/serverAdminAuth"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function generateBaseSlugFromLabel(label: string): string {
    const ascii = label
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    return ascii || "menu_item"
}

async function resolveUniqueSlug(tenantId: string, base: string): Promise<string> {
    for (let i = 0; i < 200; i++) {
        const candidate = i === 0 ? base : `${base}_${i + 1}`
        const { data, error } = await supabase
            .from("service_menu_items")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("slug", candidate)
            .maybeSingle()
        if (error) throw error
        if (!data) return candidate
    }
    return `${base}_${Date.now()}`
}

export async function GET(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    const { data, error } = await supabase
        .from("service_menu_items")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
}

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

    const body = await req.json().catch(() => ({}))
    const label = String(body?.label || "").trim()
    const price = Number(body?.price)
    const sort_order = body?.sort_order != null ? Number(body.sort_order) : 0

    if (!label) return NextResponse.json({ error: "label が必要です" }, { status: 400 })
    if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "price が不正です" }, { status: 400 })
    }
    const slug = await resolveUniqueSlug(tenantId, generateBaseSlugFromLabel(label))

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
