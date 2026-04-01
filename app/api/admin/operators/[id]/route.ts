import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { canManageTenantSettings, requireAdminSession, resolveAdminListTenantId } from "@/app/lib/serverAdminAuth"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type Params = { params: Promise<{ id: string }> }

/** スタッフの無効化（オーナーは staff のみ。オーナー行の無効化はスーパー管理者のみ） */
export async function PATCH(req: NextRequest, { params }: Params) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const isActive = body?.isActive

    if (typeof isActive !== "boolean") {
        return NextResponse.json({ error: "isActive は boolean で指定してください" }, { status: 400 })
    }

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "スタッフを管理する権限がありません" }, { status: 403 })
    }

    if (id === auth.access.operatorId) {
        return NextResponse.json({ error: "自分自身は無効化できません" }, { status: 400 })
    }

    const { data: target, error: tErr } = await supabase
        .from("admin_operators")
        .select("id, role, is_superadmin")
        .eq("id", id)
        .single()

    if (tErr || !target) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (target.is_superadmin) {
        return NextResponse.json({ error: "このアカウントは操作できません" }, { status: 403 })
    }

    const { data: link } = await supabase
        .from("admin_operator_tenants")
        .select("tenant_id")
        .eq("operator_id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle()

    if (!link) {
        return NextResponse.json({ error: "この店舗のスタッフではありません" }, { status: 404 })
    }

    // オーナーは staff 行のみ無効化・再有効化可。オーナー行はスーパー管理者のみ。
    if (target.role !== "staff" && !auth.access.isSuperadmin) {
        return NextResponse.json({ error: "オーナーアカウントの変更はスーパー管理者のみ可能です" }, { status: 403 })
    }

    const { error: upErr } = await supabase.from("admin_operators").update({ is_active: isActive }).eq("id", id)

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
