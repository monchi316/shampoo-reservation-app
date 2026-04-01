import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
    canManageTenantSettings,
    hashPassword,
    requireAdminSession,
    resolveAdminListTenantId,
} from "@/app/lib/serverAdminAuth"
import { normalizeTenantId } from "@/app/lib/serverTenantResolver"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** 店舗に紐づくオペレーター一覧（オーナー／スーパー管理者のみ） */
export async function GET(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "スタッフを管理する権限がありません" }, { status: 403 })
    }

    const { data: links, error: lErr } = await supabase
        .from("admin_operator_tenants")
        .select("operator_id")
        .eq("tenant_id", tenantId)

    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })

    const ids = (links || []).map((r) => r.operator_id as string).filter(Boolean)
    if (ids.length === 0) return NextResponse.json({ data: [] })

    const { data: rows, error } = await supabase
        .from("admin_operators")
        .select("id, email, display_name, role, is_active, is_superadmin")
        .in("id", ids)
        .order("email", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const data = (rows || []).filter((r) => !r.is_superadmin).map((r) => ({
        id: r.id,
        email: r.email,
        displayName: r.display_name,
        role: r.role as string,
        isActive: r.is_active,
    }))

    return NextResponse.json({ data })
}

/** スタッフを1名追加（オーナー／スーパー管理者のみ。role は常に staff） */
export async function POST(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const emailRaw = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""
    const displayName =
        typeof body?.displayName === "string" && body.displayName.trim().length > 0
            ? body.displayName.trim()
            : null
    const tenantFromBody = normalizeTenantId(body?.tenantId)
    const explicit = tenantFromBody || req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "スタッフを追加する権限がありません" }, { status: 403 })
    }

    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 })
    }
    if (password.length < 8) {
        return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 })
    }

    const passwordHash = hashPassword(password)

    const { data: created, error: insErr } = await supabase
        .from("admin_operators")
        .insert({
            email: emailRaw,
            display_name: displayName,
            password_hash: passwordHash,
            is_active: true,
            is_superadmin: false,
            role: "staff",
        })
        .select("id, email, display_name, role")
        .single()

    if (insErr) {
        if ((insErr as { code?: string }).code === "23505") {
            return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 })
        }
        return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    const { error: linkErr } = await supabase.from("admin_operator_tenants").insert({
        operator_id: created.id,
        tenant_id: tenantId,
    })

    if (linkErr) {
        await supabase.from("admin_operators").delete().eq("id", created.id)
        return NextResponse.json({ error: linkErr.message }, { status: 500 })
    }

    return NextResponse.json({
        data: {
            id: created.id,
            email: created.email,
            displayName: created.display_name,
            role: created.role,
        },
    })
}
