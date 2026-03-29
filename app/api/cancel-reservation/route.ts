import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { lineMessagingPush } from "@/app/lib/linePush"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"

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
        .eq("tenant_id", DEFAULT_TENANT_ID)
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

    type CancelRow = {
        user_id?: string | null
        user_name?: string | null
        date?: string | null
        time?: string | null
        maker?: string | null
        model?: string | null
        size?: string | null
        address?: string | null
    }
    const rows = data as CancelRow[]
    const userId = rows[0]?.user_id
    if (userId) {
        const first = rows[0]
        const name = (first.user_name || "").trim() || "お客様"
        const dateStr = first.date ?? ""
        const timeStr = String(first.time ?? "").slice(0, 5)
        const carBlock = rows
            .map(
                (r, i) =>
                    `${i + 1}. ${(r.maker || "").trim()} ${(r.model || "").trim()}（${(r.size || "").trim()}）`
            )
            .join("\n")
        const addr = (first.address || "").trim() || "—"
        const msg = `予約のキャンセルが完了しました。

👤 お名前：${name}
📅 日時：${dateStr} ${timeStr}
🚙 車種：
${carBlock}
📍 住所：${addr}

またのご利用をお待ちしております。`
        await lineMessagingPush(userId, msg)
    }

    return NextResponse.json({
        message: "キャンセルが完了しました 🚗✨",
    })
}