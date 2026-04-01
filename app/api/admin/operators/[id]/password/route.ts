import { NextRequest, NextResponse } from "next/server"
import { canManageTenantSettings, hashPassword, requireAdminSession, resolveAdminListTenantId } from "@/app/lib/serverAdminAuth"

type Params = { params: Promise<{ id: string }> }

/** オーナー/スーパー管理者がスタッフのパスワードを再設定する */
export async function POST(req: NextRequest, { params }: Params) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""
    if (newPassword.length < 8) {
        return NextResponse.json({ error: "新しいパスワードは8文字以上にしてください" }, { status: 400 })
    }

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "パスワード再設定の権限がありません" }, { status: 403 })
    }
    if (id === auth.access.operatorId) {
        return NextResponse.json(
            { error: "自分のパスワードはアカウント設定から変更してください" },
            { status: 400 }
        )
    }

    const { data: target, error: tErr } = await auth.supabase
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

    const { data: link } = await auth.supabase
        .from("admin_operator_tenants")
        .select("tenant_id")
        .eq("operator_id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle()
    if (!link) {
        return NextResponse.json({ error: "この店舗に紐づくアカウントではありません" }, { status: 404 })
    }
    if (target.role !== "staff" && !auth.access.isSuperadmin) {
        return NextResponse.json(
            { error: "オーナーのパスワード再設定はスーパー管理者のみ可能です" },
            { status: 403 }
        )
    }

    const { error: upErr } = await auth.supabase
        .from("admin_operators")
        .update({ password_hash: hashPassword(newPassword), is_active: true })
        .eq("id", id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
}

