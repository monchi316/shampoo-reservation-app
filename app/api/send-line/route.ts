import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const { userId, message } = await req.json()

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

    return NextResponse.json({ status: res.status })
}