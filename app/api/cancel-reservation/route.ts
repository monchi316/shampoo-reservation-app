import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// サーバー権限（service role）でSupabaseへ接続する。
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    // URLの ?id=... を取得
    const id = req.nextUrl.searchParams.get("id")
    const groupId = req.nextUrl.searchParams.get("groupId")

    if (!id && !groupId) {
        return NextResponse.json({ error: "Missing id/groupId" }, { status: 400 })
    }

    // 予約を cancelled に更新（confirmed の予約のみ対象）
    let query = supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("status", "confirmed")
        .select()

    if (groupId) {
        query = query.eq("group_id", groupId)
    } else if (id) {
        query = query.eq("id", id)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
        // 更新対象がない（ID不正 or すでに状態が違う）場合
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // 正常終了レスポンス
    return NextResponse.json({
        message: "キャンセルが完了しました 🚗✨",
    })
}