/**
 * LINE Messaging API でプッシュ通知（サーバー専用・トークンは環境変数）
 */
export async function lineMessagingPush(
    toUserId: string,
    text: string
): Promise<{ ok: boolean; status: number; lineBody: unknown }> {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!token || !toUserId?.trim()) {
        console.warn("LINE push skipped: missing LINE_CHANNEL_ACCESS_TOKEN or userId")
        return { ok: false, status: 0, lineBody: { skipped: true } }
    }

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            to: toUserId,
            messages: [{ type: "text", text }],
        }),
    })

    const lineBody = await res.json().catch(() => ({}))
    if (!res.ok) {
        console.error("LINE push failed", res.status, lineBody)
    }
    return { ok: res.ok, status: res.status, lineBody }
}
