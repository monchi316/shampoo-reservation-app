import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        // クライアントから userId / message を受け取る。
        const { userId, message } = await req.json()

        console.log("📨 送信先:", userId)
        console.log("💬 メッセージ:", message)

        // サーバー側でLINE Messaging APIへPush送信。
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

        // LINE APIの結果をそのまま返す。
        return NextResponse.json({
            status: res.status,
            data,
        })
    } catch (err) {
        // 予期しないエラーは500で返す。
        console.error("💥 APIエラー:", err)
        return NextResponse.json({ error: "failed" }, { status: 500 })
    }
}