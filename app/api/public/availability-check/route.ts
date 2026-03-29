import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { assertReservationSlotAvailable } from "@/app/lib/serverTenantData"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** 予約前チェック: 営業時間・既存予約・移動バッファ */
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}))
    const dateStr = body?.date as string | undefined
    const timeStr = body?.time as string | undefined
    const numCars = Number(body?.numCars)
    const tenantId = (body?.tenantId as string) || DEFAULT_TENANT_ID
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
