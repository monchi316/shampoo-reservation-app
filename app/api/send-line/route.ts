import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        const { userId, message } = await req.json()

        console.log("📨 送信先:", userId)
        console.log("💬 メッセージ:", message)

        const res = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: userId,
                messages: [
                    {
                        type: "text",
                        text: message,
                    },
                ],
            }),
        })

        const data = await res.json()

        console.log("📡 LINEレスポンス:", data)

        return NextResponse.json({
            status: res.status,
            data,
        })
    } catch (err) {
        console.error("💥 APIエラー:", err)
        return NextResponse.json({ error: "failed" }, { status: 500 })
    }
}