import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { lineMessagingPush } from "@/app/lib/linePush"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TZ = "Asia/Tokyo"

type ReservationRow = {
    id: string
    group_id: string | null
    tenant_id: string
    user_id: string
    user_name: string | null
    date: string
    time: string
    address: string
    maker: string
    model: string
    size: string
    status: string | null
    reminder_sent: boolean | null
}

type TenantReminderConfig = {
    id: string
    name: string
    reminder_enabled: boolean | null
    reminder_template: string | null
}

function dateInJstOffset(daysFromToday: number): string {
    const now = new Date()
    const shifted = new Date(now.getTime() + daysFromToday * 24 * 60 * 60 * 1000)
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(shifted)
}

function getBearer(req: NextRequest): string {
    const header = req.headers.get("authorization") || ""
    return header.startsWith("Bearer ") ? header.slice(7) : ""
}

function isBlockedOrUnreachable(status: number): boolean {
    // LINEでブロック・友だち解除・ID無効など再送しても改善しないケース
    return status === 400 || status === 403 || status === 404
}

function buildDefaultReminderMessage(params: {
    customerName: string
    tenantName: string
    reservationDate: string
    reservationTime: string
    carsSummary: string
    address: string
    editUrl: string
    cancelUrl: string
}): string {
    const p = params
    return `【前日リマインド】明日のご予約です🚗

👤 お名前：${p.customerName}
🏪 店舗：${p.tenantName}
📅 日時：${p.reservationDate} ${p.reservationTime}
🚙 車種：
${p.carsSummary}
📍 住所：${p.address}

変更はこちら👇
${p.editUrl}

キャンセルはこちら👇
${p.cancelUrl}`
}

function applyTemplate(
    template: string,
    params: {
        customerName: string
        tenantName: string
        reservationDate: string
        reservationTime: string
        carsSummary: string
        address: string
        editUrl: string
        cancelUrl: string
    }
): string {
    return template
        .replaceAll("{{customer_name}}", params.customerName)
        .replaceAll("{{tenant_name}}", params.tenantName)
        .replaceAll("{{reservation_date}}", params.reservationDate)
        .replaceAll("{{reservation_time}}", params.reservationTime)
        .replaceAll("{{cars_summary}}", params.carsSummary)
        .replaceAll("{{address}}", params.address)
        .replaceAll("{{edit_url}}", params.editUrl)
        .replaceAll("{{cancel_url}}", params.cancelUrl)
}

export async function GET(req: NextRequest) {
    const secret = process.env.REMINDER_CRON_SECRET || process.env.CRON_SECRET
    if (!secret || getBearer(req) !== secret) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin
    const targetDate = dateInJstOffset(1) // JSTの「明日」

    const { data: rows, error } = await supabase
        .from("reservations")
        .select("id, group_id, tenant_id, user_id, user_name, date, time, address, maker, model, size, status, reminder_sent")
        .eq("date", targetDate)
        .neq("status", "cancelled")
        .or("reminder_sent.is.null,reminder_sent.eq.false")

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const candidates = (rows || []) as ReservationRow[]
    if (candidates.length === 0) {
        return NextResponse.json({ ok: true, targetDate, sent: 0, skipped: 0, failed: 0 })
    }

    const tenantIds = Array.from(new Set(candidates.map((r) => r.tenant_id)))
    const { data: tenantRows } = await supabase
        .from("tenants")
        .select("id, name, reminder_enabled, reminder_template")
        .in("id", tenantIds)

    const tenantMap = new Map<string, TenantReminderConfig>()
    for (const t of (tenantRows || []) as TenantReminderConfig[]) {
        tenantMap.set(t.id, t)
    }

    const groupMap = new Map<string, ReservationRow[]>()
    for (const r of candidates) {
        const key = `${r.tenant_id}:${r.group_id || r.id}`
        const cur = groupMap.get(key)
        if (cur) cur.push(r)
        else groupMap.set(key, [r])
    }

    let sent = 0
    let failed = 0
    let skipped = 0

    for (const rowsInGroup of groupMap.values()) {
        const first = rowsInGroup[0]
        const tenant = tenantMap.get(first.tenant_id)
        if (tenant && tenant.reminder_enabled === false) {
            skipped += 1
            continue
        }

        const reservationId = first.id
        const groupId = first.group_id || first.id
        const tenantQuery = `tenantId=${encodeURIComponent(first.tenant_id)}`
        const editUrl = `${baseUrl}/edit-reservation?id=${reservationId}&groupId=${groupId}&${tenantQuery}`
        const cancelUrl = `${baseUrl}/cancel-reservation?id=${reservationId}&groupId=${groupId}&${tenantQuery}`
        const carsSummary = rowsInGroup
            .map((r, i) => `${i + 1}. ${r.maker} ${r.model}（${r.size}）`)
            .join("\n")
        const customerName = first.user_name || "お客様"
        const tenantName = tenant?.name || "店舗"

        const template = (tenant?.reminder_template || "").trim()
        const message =
            template.length > 0
                ? applyTemplate(template, {
                      customerName,
                      tenantName,
                      reservationDate: first.date,
                      reservationTime: String(first.time || "").slice(0, 5),
                      carsSummary,
                      address: first.address || "",
                      editUrl,
                      cancelUrl,
                  })
                : buildDefaultReminderMessage({
                      customerName,
                      tenantName,
                      reservationDate: first.date,
                      reservationTime: String(first.time || "").slice(0, 5),
                      carsSummary,
                      address: first.address || "",
                      editUrl,
                      cancelUrl,
                  })

        const { ok, status, lineBody } = await lineMessagingPush({
            tenantId: first.tenant_id,
            toUserId: first.user_id,
            text: message,
            kind: "reminder",
            reservationGroupId: first.group_id || first.id,
        })
        const ids = rowsInGroup.map((r) => r.id)
        const errText = ok ? null : `status=${status} body=${JSON.stringify(lineBody)}`

        // 冪等性: 成功済み(reminder_sent=true)は次回対象外。
        // ブロック等の非再試行系エラーも送達不能として完了扱いにし、毎日失敗し続けるのを防ぐ。
        const shouldClose = ok || isBlockedOrUnreachable(status)
        const patch: Record<string, unknown> = {
            reminder_error: errText,
        }
        if (shouldClose) {
            patch.reminder_sent = true
            patch.reminder_sent_at = new Date().toISOString()
        }

        const { error: upErr } = await supabase.from("reservations").update(patch).in("id", ids)
        if (upErr) {
            failed += 1
            continue
        }

        if (ok) {
            sent += 1
        } else {
            failed += 1
        }
    }

    return NextResponse.json({
        ok: true,
        targetDate,
        sent,
        skipped,
        failed,
        groups: groupMap.size,
    })
}

