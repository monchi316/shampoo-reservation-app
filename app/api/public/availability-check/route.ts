import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { assertReservationSlotAvailable, listAvailableStartTimes } from "@/app/lib/serverTenantData"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"
import { ensureTenantExists, normalizeTenantId } from "@/app/lib/serverTenantResolver"

/** YYYY-M-D 等を YYYY-MM-DD に揃え、営業日・曜日判定のブレを防ぐ */
function normalizeCalendarDateInput(raw: string): string {
    const m = String(raw || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (!m) return String(raw || "").trim()
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
}

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams
    const dateStr = normalizeCalendarDateInput(sp.get("date") || "")
    const numCars = Number(sp.get("numCars"))
    const tenantId = normalizeTenantId(sp.get("tenantId")) || DEFAULT_TENANT_ID
    const excludeGroupId = sp.get("excludeGroupId")
    const excludeReservationIdsRaw = sp.get("excludeReservationIds")
    const excludeReservationIds = excludeReservationIdsRaw
        ? excludeReservationIdsRaw.split(",").map((x) => x.trim()).filter(Boolean)
        : undefined

    if (!dateStr || !Number.isFinite(numCars) || numCars < 1) {
        return NextResponse.json({ error: "date, numCars が必要です" }, { status: 400 })
    }
    const exists = await ensureTenantExists(supabase, tenantId)
    if (!exists) {
        return NextResponse.json({ error: "tenant が見つかりません" }, { status: 404 })
    }

    const result = await listAvailableStartTimes(supabase, {
        tenantId,
        dateStr,
        numCars,
        excludeGroupId: excludeGroupId && excludeGroupId.length > 0 ? excludeGroupId : undefined,
        excludeReservationIds: excludeReservationIds?.length ? excludeReservationIds : undefined,
    })
    return NextResponse.json(result)
}

/** 予約前チェック: 営業時間・既存予約・移動バッファ */
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}))
    const dateStr =
        typeof body?.date === "string" ? normalizeCalendarDateInput(body.date) : undefined
    const timeStr = body?.time as string | undefined
    const numCars = Number(body?.numCars)
    const tenantId = normalizeTenantId(body?.tenantId) || DEFAULT_TENANT_ID
    const excludeGroupId =
        typeof body?.excludeGroupId === "string" && body.excludeGroupId.length > 0
            ? body.excludeGroupId
            : null
    const excludeReservationIds = Array.isArray(body?.excludeReservationIds)
        ? (body.excludeReservationIds as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
        : undefined

    if (!dateStr || !timeStr || !Number.isFinite(numCars) || numCars < 1) {
        return NextResponse.json({ error: "date, time, numCars が必要です" }, { status: 400 })
    }
    const exists = await ensureTenantExists(supabase, tenantId)
    if (!exists) {
        return NextResponse.json({ error: "tenant が見つかりません" }, { status: 404 })
    }

    const result = await assertReservationSlotAvailable(supabase, {
        tenantId,
        dateStr,
        timeStr,
        numCars,
        excludeGroupId,
        excludeReservationIds: excludeReservationIds?.length ? excludeReservationIds : undefined,
    })

    return NextResponse.json(result)
}
