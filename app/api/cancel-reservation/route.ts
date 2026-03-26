import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id")

    if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const { data, error } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("status", "confirmed")
        .select()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
        message: "キャンセルが完了しました 🚗✨",
    })
}