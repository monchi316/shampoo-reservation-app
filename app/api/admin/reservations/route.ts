import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams
    const date = searchParams.get("date")
    const status = searchParams.get("status")
    const q = searchParams.get("q")

    let query = supabase
        .from("reservations")
        .select("*")
        .eq("tenant_id", DEFAULT_TENANT_ID)
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .limit(500)

    if (date) {
        query = query.eq("date", date)
    }
    if (status && status !== "all") {
        query = query.eq("status", status)
    }
    if (q) {
        query = query.or(
            `user_name.ilike.%${q}%,maker.ilike.%${q}%,model.ilike.%${q}%,address.ilike.%${q}%`
        )
    }

    const { data, error } = await query
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data || []
    const missingUserIds = Array.from(
        new Set(
            rows
                .filter((r: any) => !r.user_name && r.user_id)
                .map((r: any) => r.user_id)
        )
    )

    let userNameMap = new Map<string, string>()
    if (missingUserIds.length > 0) {
        const { data: users } = await supabase
            .from("users")
            .select("user_id, user_name")
            .in("user_id", missingUserIds)
        userNameMap = new Map(
            (users || [])
                .filter((u: any) => u.user_id && u.user_name)
                .map((u: any) => [u.user_id, u.user_name])
        )
    }

    const normalized = rows.map((r: any) => ({
        ...r,
        user_name: r.user_name || userNameMap.get(r.user_id) || null,
    }))

    return NextResponse.json({ data: normalized })
}
