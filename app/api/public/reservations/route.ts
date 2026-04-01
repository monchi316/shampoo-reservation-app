import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { assertReservationSlotAvailable } from "@/app/lib/serverTenantData"
import { DEFAULT_TENANT_ID } from "@/app/lib/tenant"
import { ensureTenantExists, normalizeTenantId } from "@/app/lib/serverTenantResolver"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type InsertRow = {
    group_id: string
    user_id: string
    user_name: string
    maker: string
    model: string
    size: string
    date: string
    time: string
    address: string
    interior: boolean
    addon_slugs?: string[]
}

function isInsertRow(x: unknown): x is InsertRow {
    if (!x || typeof x !== "object") return false
    const r = x as Record<string, unknown>
    return (
        typeof r.group_id === "string" &&
        typeof r.user_id === "string" &&
        typeof r.user_name === "string" &&
        typeof r.maker === "string" &&
        typeof r.model === "string" &&
        typeof r.size === "string" &&
        typeof r.date === "string" &&
        typeof r.time === "string" &&
        typeof r.address === "string" &&
        typeof r.interior === "boolean" &&
        (r.addon_slugs === undefined ||
            (Array.isArray(r.addon_slugs) &&
                r.addon_slugs.every((x) => typeof x === "string" && x.length > 0)))
    )
}

/**
 * ブラウザの anon キーでは RLS に阻まれるため、予約の書き込みは service_role で行う。
 * 公開 API のため、テナントはサーバー側の DEFAULT のみ許可し、空き確認を必ず再実行する。
 */
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}))
    const action = body?.action as string | undefined
    const tenantId = normalizeTenantId(body?.tenantId) || DEFAULT_TENANT_ID
    const exists = await ensureTenantExists(supabase, tenantId)
    if (!exists) {
        return NextResponse.json({ error: "tenant が見つかりません" }, { status: 404 })
    }

    if (action === "insert") {
        const rowsRaw = body?.rows
        if (!Array.isArray(rowsRaw) || rowsRaw.length === 0 || !rowsRaw.every(isInsertRow)) {
            return NextResponse.json({ error: "rows が不正です" }, { status: 400 })
        }
        const rows = rowsRaw as InsertRow[]
        const first = rows[0]
        if (!rows.every((r) => r.group_id === first.group_id && r.date === first.date && r.time === first.time)) {
            return NextResponse.json({ error: "同一グループ・日時の行のみ登録できます" }, { status: 400 })
        }

        const avail = await assertReservationSlotAvailable(supabase, {
            tenantId,
            dateStr: first.date,
            timeStr: first.time,
            numCars: rows.length,
        })
        if (!avail.ok) {
            return NextResponse.json({ error: avail.reason }, { status: 409 })
        }

        const payload = rows.map((r) => ({
            ...r,
            addon_slugs: Array.isArray(r.addon_slugs) ? r.addon_slugs : [],
            tenant_id: tenantId,
            status: "confirmed",
        }))

        const { data, error } = await supabase
            .from("reservations")
            .insert(payload)
            .select()
            .order("id", { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
        }
        return NextResponse.json({ data: data || [] })
    }

    if (action === "replace_group") {
        const groupId = body?.group_id as string | undefined
        const rowsRaw = body?.rows
        if (!groupId || !Array.isArray(rowsRaw) || rowsRaw.length === 0 || !rowsRaw.every(isInsertRow)) {
            return NextResponse.json({ error: "group_id と rows が必要です" }, { status: 400 })
        }
        const rows = rowsRaw as InsertRow[]
        const first = rows[0]
        if (!rows.every((r) => r.group_id === groupId && r.date === first.date && r.time === first.time)) {
            return NextResponse.json({ error: "group_id・日付・時刻が一致する行のみ登録できます" }, { status: 400 })
        }

        const avail = await assertReservationSlotAvailable(supabase, {
            tenantId,
            dateStr: first.date,
            timeStr: first.time,
            numCars: rows.length,
            excludeGroupId: groupId,
        })
        if (!avail.ok) {
            return NextResponse.json({ error: avail.reason }, { status: 409 })
        }

        const { error: delErr } = await supabase
            .from("reservations")
            .delete()
            .eq("tenant_id", tenantId)
            .eq("group_id", groupId)

        if (delErr) {
            return NextResponse.json({ error: delErr.message }, { status: 500 })
        }

        const payload = rows.map((r) => ({
            ...r,
            addon_slugs: Array.isArray(r.addon_slugs) ? r.addon_slugs : [],
            tenant_id: tenantId,
            status: "confirmed",
        }))

        const { data, error } = await supabase
            .from("reservations")
            .insert(payload)
            .select()
            .order("id", { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
        }
        return NextResponse.json({ data: data || [] })
    }

    if (action === "update_one") {
        const reservationId = body?.reservation_id as string | undefined
        const fields = body?.fields as Record<string, unknown> | undefined
        if (!reservationId || !fields || typeof fields !== "object") {
            return NextResponse.json({ error: "reservation_id と fields が必要です" }, { status: 400 })
        }

        const { data: current, error: curErr } = await supabase
            .from("reservations")
            .select("id, date, time")
            .eq("id", reservationId)
            .eq("tenant_id", tenantId)
            .maybeSingle()

        if (curErr) {
            return NextResponse.json({ error: curErr.message }, { status: 500 })
        }
        if (!current) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        const allowed = new Set([
            "user_name",
            "maker",
            "model",
            "size",
            "date",
            "time",
            "address",
            "interior",
            "addon_slugs",
        ])
        const patch: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(fields)) {
            if (!allowed.has(k)) continue
            if (k === "interior") {
                patch[k] = !!v
            } else if (k === "addon_slugs") {
                if (Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0)) {
                    patch[k] = v
                }
            } else if (typeof v === "string") {
                patch[k] = v
            }
        }
        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: "更新できる項目がありません" }, { status: 400 })
        }

        if (patch.date != null || patch.time != null) {
            const dateStr = (patch.date as string) || String(current.date || "")
            const timeStr = (patch.time as string) || String(current.time || "").slice(0, 5)
            const avail = await assertReservationSlotAvailable(supabase, {
                tenantId,
                dateStr,
                timeStr,
                numCars: 1,
                excludeReservationIds: [reservationId],
            })
            if (!avail.ok) {
                return NextResponse.json({ error: avail.reason }, { status: 409 })
            }
        }

        const { data, error } = await supabase
            .from("reservations")
            .update(patch)
            .eq("id", reservationId)
            .eq("tenant_id", tenantId)
            .select()
            .maybeSingle()

        if (error) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
        }
        if (!data) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }
        return NextResponse.json({ data })
    }

    return NextResponse.json({ error: "action は insert / replace_group / update_one" }, { status: 400 })
}

/** 変更リンク用: ブラウザの anon では RLS で読めないため service_role で取得 */
export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id")
    const groupId = req.nextUrl.searchParams.get("groupId")
    const tenantId = normalizeTenantId(req.nextUrl.searchParams.get("tenantId")) || DEFAULT_TENANT_ID
    const exists = await ensureTenantExists(supabase, tenantId)
    if (!exists) {
        return NextResponse.json({ error: "tenant が見つかりません" }, { status: 404 })
    }

    if (!id && !groupId) {
        return NextResponse.json({ error: "id または groupId が必要です" }, { status: 400 })
    }

    if (groupId) {
        const { data, error } = await supabase
            .from("reservations")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("group_id", groupId)
            .order("id", { ascending: true })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        if (!data?.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
        return NextResponse.json({ data })
    }

    const { data: one, error: errOne } = await supabase
        .from("reservations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", id!)
        .maybeSingle()

    if (errOne) return NextResponse.json({ error: errOne.message }, { status: 500 })
    if (!one) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (one.group_id) {
        const { data: grouped, error: errG } = await supabase
            .from("reservations")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("group_id", one.group_id)
            .order("id", { ascending: true })

        if (errG) return NextResponse.json({ error: errG.message }, { status: 500 })
        return NextResponse.json({ data: grouped?.length ? grouped : [one] })
    }

    return NextResponse.json({ data: [one] })
}
