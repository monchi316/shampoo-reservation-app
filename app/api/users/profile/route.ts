import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// service role で users テーブルを安全に更新/参照する。
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get("userId")
    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const { data, error } = await supabase
        .from("users")
        .select("user_id, user_name, maker, model, size, address, cars, last_address, last_address_type, home_address, work_address, other_address")
        .eq("user_id", userId)
        .single()

    if (error) {
        // データ未登録時は 404 として返す（初回予約時の想定）。
        if (error.code === "PGRST116") {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
    try {
        const {
            user_id,
            user_name,
            maker,
            model,
            size,
            address,
            cars,
            last_address,
            last_address_type,
            home_address,
            work_address,
            other_address,
        } = await req.json()
        if (!user_id) {
            return NextResponse.json({ error: "Missing user_id" }, { status: 400 })
        }

        const { error } = await supabase
            .from("users")
            .upsert(
                [
                    {
                        user_id,
                        user_name: user_name || null,
                        maker: maker || null,
                        model: model || null,
                        size: size || null,
                        address: address || null,
                        cars: cars || null,
                        last_address: last_address || null,
                        last_address_type: last_address_type || null,
                        home_address: home_address || null,
                        work_address: work_address || null,
                        other_address: other_address || null,
                    },
                ],
                { onConflict: "user_id" }
            )

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
