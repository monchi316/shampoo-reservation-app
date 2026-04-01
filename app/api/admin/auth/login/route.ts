import { NextRequest, NextResponse } from "next/server"
import { ADMIN_SESSION_COOKIE } from "@/app/lib/adminSessionConstants"
import { createServiceSupabase, signAdminSessionToken, verifyPassword } from "@/app/lib/serverAdminAuth"

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}))
    const emailRaw = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""
    if (!emailRaw || !password) {
        return NextResponse.json({ error: "メールアドレスとパスワードが必要です" }, { status: 400 })
    }

    const secret = process.env.ADMIN_SESSION_SECRET
    if (typeof secret !== "string" || secret.length < 32) {
        return NextResponse.json(
            { error: "ADMIN_SESSION_SECRET が未設定か短すぎます（32文字以上）" },
            { status: 500 }
        )
    }

    const supabase = createServiceSupabase()
    const { data: op, error } = await supabase
        .from("admin_operators")
        .select("id, password_hash, is_active")
        .eq("email", emailRaw)
        .maybeSingle()

    if (error) {
        const code = (error as { code?: string }).code
        if (code === "42P01") {
            return NextResponse.json(
                { error: "admin_operators テーブルがありません。Phase 2 の SQL を実行してください。" },
                { status: 500 }
            )
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!op || op.is_active === false) {
        return NextResponse.json({ error: "メールまたはパスワードが正しくありません" }, { status: 401 })
    }
    const hash = op.password_hash as string
    if (!verifyPassword(password, hash)) {
        return NextResponse.json({ error: "メールまたはパスワードが正しくありません" }, { status: 401 })
    }

    const sessionToken = signAdminSessionToken(op.id as string)
    if (!sessionToken) {
        return NextResponse.json({ error: "セションの発行に失敗しました" }, { status: 500 })
    }

    const res = NextResponse.json({ ok: true })
    const maxAge = 60 * 60 * 24 * 7
    res.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge,
    })
    return res
}
