import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { loadSchedulingBundle } from "@/app/lib/serverTenantData"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TENANT = DEFAULT_TENANT_ID

export async function GET() {
    const bundle = await loadSchedulingBundle(supabase, TENANT)
    const { data: settingsRow } = await supabase
        .from("tenant_scheduling_settings")
        .select("*")
        .eq("tenant_id", TENANT)
        .maybeSingle()

    return NextResponse.json({
        tenantId: TENANT,
        settings: settingsRow,
        weekly: bundle.weekly,
        exceptions: bundle.exceptions,
    })
}

export async function PUT(req: NextRequest) {
    const body = await req.json().catch(() => ({}))

    const mode = body?.business_hours_mode
    if (mode !== "uniform" && mode !== "weekly") {
        return NextResponse.json({ error: "business_hours_mode は uniform か weekly" }, { status: 400 })
    }

    const avgService = Number(body?.avg_service_minutes_per_car)
    const avgTravel = Number(body?.avg_travel_minutes)
    if (!Number.isFinite(avgService) || avgService < 1 || avgService > 1440) {
        return NextResponse.json({ error: "avg_service_minutes_per_car が不正" }, { status: 400 })
    }
    if (!Number.isFinite(avgTravel) || avgTravel < 0 || avgTravel > 480) {
        return NextResponse.json({ error: "avg_travel_minutes が不正" }, { status: 400 })
    }

    const uniform_open = body?.uniform_open ?? null
    const uniform_close = body?.uniform_close ?? null

    const { error: upErr } = await supabase
        .from("tenant_scheduling_settings")
        .upsert(
            {
                tenant_id: TENANT,
                business_hours_mode: mode,
                uniform_open,
                uniform_close,
                avg_service_minutes_per_car: avgService,
                avg_travel_minutes: avgTravel,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id" }
        )

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    if (Array.isArray(body?.weekly)) {
        await supabase.from("business_hours_weekly").delete().eq("tenant_id", TENANT)
        const rows = body.weekly.map((w: any) => ({
            tenant_id: TENANT,
            day_of_week: Number(w.day_of_week),
            is_closed: !!w.is_closed,
            open_time: w.open_time || null,
            close_time: w.close_time || null,
        }))
        for (const r of rows) {
            if (r.day_of_week < 0 || r.day_of_week > 6) {
                return NextResponse.json({ error: "weekly day_of_week は 0–6" }, { status: 400 })
            }
        }
        const { error: wErr } = await supabase.from("business_hours_weekly").insert(rows)
        if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })
    }

    if (Array.isArray(body?.exceptions)) {
        await supabase.from("business_hours_exceptions").delete().eq("tenant_id", TENANT)
        const exRows = body.exceptions.map((e: any) => ({
            tenant_id: TENANT,
            exception_date: e.exception_date,
            is_closed: !!e.is_closed,
            open_time: e.open_time || null,
            close_time: e.close_time || null,
        }))
        if (exRows.length > 0) {
            const { error: eErr } = await supabase.from("business_hours_exceptions").insert(exRows)
            if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
        }
    }

    const bundle = await loadSchedulingBundle(supabase, TENANT)
    const { data: settingsRow } = await supabase
        .from("tenant_scheduling_settings")
        .select("*")
        .eq("tenant_id", TENANT)
        .maybeSingle()

    return NextResponse.json({
        tenantId: TENANT,
        settings: settingsRow,
        weekly: bundle.weekly,
        exceptions: bundle.exceptions,
    })
}
