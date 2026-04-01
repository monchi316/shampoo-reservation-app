import { NextRequest, NextResponse } from "next/server"
import { hashPassword, requireAdminSession, verifyPassword } from "@/app/lib/serverAdminAuth"

export async function POST(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

    if (!currentPassword || !newPassword) {
        return NextResponse.json(
            { error: "currentPassword と newPassword は必須です" },
            { status: 400 }
        )
    }
    if (newPassword.length < 8) {
        return NextResponse.json({ error: "新しいパスワードは8文字以上にしてください" }, { status: 400 })
    }

    const { data: row, error } = await auth.supabase
        .from("admin_operators")
        .select("id, password_hash")
        .eq("id", auth.access.operatorId)
        .single()

    if (error || !row) {
        return NextResponse.json({ error: "オペレーター情報の取得に失敗しました" }, { status: 500 })
    }

    const currentHash = row.password_hash as string
    if (!verifyPassword(currentPassword, currentHash)) {
        return NextResponse.json({ error: "現在のパスワードが正しくありません" }, { status: 401 })
    }
    if (verifyPassword(newPassword, currentHash)) {
        return NextResponse.json(
            { error: "現在と同じパスワードは設定できません" },
            { status: 400 }
        )
    }

    const { error: upErr } = await auth.supabase
        .from("admin_operators")
        .update({ password_hash: hashPassword(newPassword) })
        .eq("id", auth.access.operatorId)

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}

