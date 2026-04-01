import { NextResponse } from "next/server"
import { lineMessagingPush } from "@/app/lib/linePush"

export async function POST(req: Request) {
    try {
        const { tenantId, userId, message, kind, reservationGroupId } = await req.json()

        console.log("🏪 tenant:", tenantId)
        console.log("📨 送信先:", userId)
        console.log("💬 メッセージ:", message)

        const { ok, status, lineBody } = await lineMessagingPush({
            tenantId: String(tenantId || ""),
            toUserId: String(userId || ""),
            text: String(message || ""),
            kind: kind || "test",
            reservationGroupId: reservationGroupId || null,
        })

        console.log("📡 LINEレスポンス:", lineBody)

        return NextResponse.json({
            status: ok ? status : status || 500,
            data: lineBody,
        })
    } catch (err) {
        console.error("💥 APIエラー:", err)
        return NextResponse.json({ error: "failed" }, { status: 500 })
    }
}