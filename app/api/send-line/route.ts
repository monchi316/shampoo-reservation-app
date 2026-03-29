import { NextResponse } from "next/server"
import { lineMessagingPush } from "@/app/lib/linePush"

export async function POST(req: Request) {
    try {
        const { userId, message } = await req.json()

        console.log("📨 送信先:", userId)
        console.log("💬 メッセージ:", message)

        const { ok, status, lineBody } = await lineMessagingPush(String(userId || ""), String(message || ""))

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