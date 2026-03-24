import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
    try {
        const url = new URL(req.url)
        const id = url.searchParams.get("id")
        if (!id) return new Response("Missing id", { status: 400 })

        // 予約をキャンセル
        const { data, error } = await supabase
            .from("reservations")
            .update({ status: "cancelled" })
            .eq("id", id)
            .eq("status", "confirmed")
            .select()

        if (error) {
            console.error("DB error:", error)
            return new Response("DB error", { status: 500 })
        }

        if (!data || data.length === 0) {
            return new Response("Reservation not found", { status: 404 })
        }

        return new Response(
            "キャンセルが完了しました🚗\nまたのご利用をお待ちしております！",
            { status: 200 }
        )
    } catch (err) {
        console.error("Unexpected error:", err)
        return new Response("Unexpected error", { status: 500 })
    }
})