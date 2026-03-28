import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Params = {
    params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
    const { id } = await params

    const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", id)
        .single()

    if (error || !data) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    let grouped = [data]
    if (data.group_id) {
        const { data: groupRows } = await supabase
            .from("reservations")
            .select("*")
            .eq("group_id", data.group_id)
            .order("id", { ascending: true })
        grouped = groupRows || [data]
    }

    // reservations.user_name が空の古いデータ対策として users から補完
    let fallbackUserName: string | null = null
    if (!data.user_name && data.user_id) {
        const { data: userRow } = await supabase
            .from("users")
            .select("user_name")
            .eq("user_id", data.user_id)
            .single()
        fallbackUserName = userRow?.user_name || null
    }

    const patchedData = {
        ...data,
        user_name: data.user_name || fallbackUserName,
    }
    const patchedGrouped = grouped.map((r: any) => ({
        ...r,
        user_name: r.user_name || fallbackUserName,
    }))

    return NextResponse.json({
        data: patchedData,
        groupRows: patchedGrouped,
    })
}

export async function PATCH(req: NextRequest, { params }: Params) {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const status = body?.status as string | undefined
    const salesAmount = body?.sales_amount as number | null | undefined
    const extraFee = body?.extra_fee as number | null | undefined
    const memo = body?.memo as string | null | undefined
    const serviceDoneAt = body?.service_done_at as string | null | undefined
    const staffName = body?.staff_name as string | null | undefined
    const applyGroup = !!body?.applyGroup
    const rawTargets = body?.target_ids
    const targetIds: string[] = Array.isArray(rawTargets)
        ? rawTargets.filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
        : []

    const rawSalesById = body?.sales_amounts_by_id
    let salesAmountsById: Record<string, number> | null = null
    if (rawSalesById && typeof rawSalesById === "object" && !Array.isArray(rawSalesById)) {
        const out: Record<string, number> = {}
        for (const [k, v] of Object.entries(rawSalesById as Record<string, unknown>)) {
            if (typeof k === "string" && k.length > 0 && typeof v === "number" && !Number.isNaN(v)) {
                out[k] = v
            }
        }
        salesAmountsById = Object.keys(out).length > 0 ? out : null
    }

    const updatePayload: Record<string, unknown> = {}
    if (typeof status === "string") updatePayload.status = status
    if (salesAmount !== undefined) updatePayload.sales_amount = salesAmount
    if (extraFee !== undefined) updatePayload.extra_fee = extraFee
    if (memo !== undefined) updatePayload.memo = memo
    if (serviceDoneAt !== undefined) updatePayload.service_done_at = serviceDoneAt
    if (staffName !== undefined) updatePayload.staff_name = staffName

    if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ error: "No update fields" }, { status: 400 })
    }

    const { data: baseRow, error: baseErr } = await supabase
        .from("reservations")
        .select("id, group_id")
        .eq("id", id)
        .single()

    if (baseErr || !baseRow) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const usePerRowSales =
        !applyGroup &&
        targetIds.length > 1 &&
        salesAmountsById !== null &&
        Object.keys(salesAmountsById).length > 0

    if (usePerRowSales && salesAmountsById) {
        for (const tid of targetIds) {
            if (!(tid in salesAmountsById)) {
                return NextResponse.json(
                    { error: "sales_amounts_by_id must include every target_ids entry" },
                    { status: 400 }
                )
            }
        }
    }

    const baseUpdatePayload = { ...updatePayload }
    if (usePerRowSales) {
        delete baseUpdatePayload.sales_amount
    }

    if (usePerRowSales) {
        if (!salesAmountsById) {
            return NextResponse.json({ error: "sales_amounts_by_id is required" }, { status: 400 })
        }
        if (!baseRow.group_id) {
            return NextResponse.json(
                { error: "sales_amounts_by_id requires a grouped reservation" },
                { status: 400 }
            )
        }
        const { data: validRows, error: vErr } = await supabase
            .from("reservations")
            .select("id")
            .in("id", targetIds)
            .eq("group_id", baseRow.group_id)

        if (vErr || !validRows || validRows.length !== targetIds.length) {
            return NextResponse.json(
                { error: "target_ids must all belong to the same group as this reservation" },
                { status: 400 }
            )
        }

        const byId = salesAmountsById
        for (const tid of targetIds) {
            const rowPayload = {
                ...baseUpdatePayload,
                sales_amount: byId[tid],
            }
            const { error } = await supabase.from("reservations").update(rowPayload).eq("id", tid)
            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 })
            }
        }
        return NextResponse.json({ ok: true })
    }

    let query = supabase.from("reservations").update(updatePayload)

    if (applyGroup && baseRow.group_id) {
        query = query.eq("group_id", baseRow.group_id)
    } else if (!applyGroup) {
        if (targetIds.length === 0) {
            query = query.eq("id", id)
        } else if (!baseRow.group_id) {
            if (targetIds.length !== 1 || targetIds[0] !== baseRow.id) {
                return NextResponse.json(
                    { error: "Invalid target_ids for reservation without group_id" },
                    { status: 400 }
                )
            }
            query = query.eq("id", baseRow.id)
        } else {
            const { data: validRows, error: vErr } = await supabase
                .from("reservations")
                .select("id")
                .in("id", targetIds)
                .eq("group_id", baseRow.group_id)

            if (vErr || !validRows || validRows.length !== targetIds.length) {
                return NextResponse.json(
                    { error: "target_ids must all belong to the same group as this reservation" },
                    { status: 400 }
                )
            }
            query = query.in("id", targetIds)
        }
    } else {
        query = query.eq("id", id)
    }

    const { error } = await query
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
