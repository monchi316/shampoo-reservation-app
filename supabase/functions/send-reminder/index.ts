import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Supabaseバックエンドクライアント
const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const CANCEL_URL_BASE = Deno.env.get("CANCEL_URL_BASE")!

serve(async () => {
    try {
        // 日本時間で明日の日付
        const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const yyyy = tomorrow.getFullYear()
        const mm = String(tomorrow.getMonth() + 1).padStart(2, "0")
        const dd = String(tomorrow.getDate()).padStart(2, "0")
        const targetDate = `${yyyy}-${mm}-${dd}`

        // ① 送信対象の予約をロックして取得（二重送信防止）
        const { data, error } = await supabase
            .from("reservations")
            .update({ reminder_sent: true })
            .eq("date", targetDate)
            .eq("reminder_sent", false)
            .eq("status", "confirmed") // キャンセル済み除外
            .select()

        if (error) {
            console.error("Supabase error:", error)
            console.error("🔥 DB error詳細:", error)
            return new Response("DB error", { status: 500 })
        }

        if (!data || data.length === 0) {
            console.log("No reservations to send")
            return new Response("No reservations to send", { status: 200 })
        }

        // ② LINE通知を順番に送信
        for (const r of data) {
            try {
                const res = await fetch("https://api.line.me/v2/bot/message/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")}`
                    },
                    body: JSON.stringify({
                        to: r.user_id,
                        messages: [
                            {
                                type: "text",
                                text: `🚗明日は洗車日です！

📅 日付：${r.date}
⏰ 時間：${r.time}

伺わせていただくのを楽しみにしています✨
キャンセルはこちら👇
${CANCEL_URL_BASE}?id=${r.id}`
                            }
                        ]
                    })
                })

                // 👇 これ追加
                const text = await res.text()
                console.log("LINEレスポンス:", res.status, text)

                if (res.ok) {
                    // ✅ 成功したら更新
                    await supabase
                        .from("reservations")
                        .update({ reminder_sent: true })
                        .eq("id", r.id)
                } else {
                    console.error("LINE送信失敗:", res.status, text)
                }
            } catch (err) {
                console.error(`LINE送信エラー: ${r.id}`, err)
            }
        }

        return new Response("ok")
    } catch (err) {
        console.error("Unexpected error:", err)
        return new Response("Unexpected error", { status: 500 })
    }
})