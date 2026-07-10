import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseLineAdminNotifyUserIds, pushLineToTenantAdmins } from "@/app/lib/lineAdminNotify"
import { lineMessagingPush } from "@/app/lib/linePush"
import {
    buildReservationFlexMessage,
    resolveReservationChangeMessage,
    resolveReservationCompleteMessage,
    stripActionUrlsFromLineBody,
    type LinePushTemplateVars,
} from "@/app/lib/lineMessageTemplates"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type TemplatePayload = {
    type: "reservation_created" | "reservation_updated"
    vars: Partial<Record<keyof LinePushTemplateVars, string>>
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const tenantId = String(body.tenantId || "")
        const userId = String(body.userId || "")
        const kind = body.kind || "test"
        const reservationGroupId = body.reservationGroupId || null
        const messageTemplate = body.messageTemplate as TemplatePayload | undefined

        let text: string
        let adminUserIds: string[] = []
        if (
            messageTemplate?.type &&
            (messageTemplate.type === "reservation_created" ||
                messageTemplate.type === "reservation_updated") &&
            messageTemplate.vars &&
            typeof messageTemplate.vars === "object"
        ) {
            const { data: tenant, error: tErr } = await supabase
                .from("tenants")
                .select(
                    "name, line_message_template_reservation_complete, line_message_template_reservation_change, line_admin_notify_user_ids"
                )
                .eq("id", tenantId)
                .maybeSingle()

            if (tErr) {
                console.error("send-line tenant load:", tErr)
                return NextResponse.json({ error: "tenant load failed" }, { status: 500 })
            }

            adminUserIds = parseLineAdminNotifyUserIds(tenant?.line_admin_notify_user_ids)

            const v = messageTemplate.vars
            const vars: LinePushTemplateVars = {
                customer_name: String(v.customer_name ?? ""),
                tenant_name: String(tenant?.name ?? "店舗"),
                reservation_date: String(v.reservation_date ?? ""),
                reservation_time: String(v.reservation_time ?? ""),
                cars_summary: String(v.cars_summary ?? ""),
                address: String(v.address ?? ""),
                edit_url: String(v.edit_url ?? ""),
                cancel_url: String(v.cancel_url ?? ""),
            }

            const completeTpl = tenant?.line_message_template_reservation_complete as string | null | undefined
            const changeTpl = tenant?.line_message_template_reservation_change as string | null | undefined

            text =
                messageTemplate.type === "reservation_created"
                    ? resolveReservationCompleteMessage(completeTpl, vars)
                    : resolveReservationChangeMessage(changeTpl, vars)

            const editU = vars.edit_url
            const cancelU = vars.cancel_url
            if (editU.startsWith("https://") && cancelU.startsWith("https://")) {
                const bodyText = stripActionUrlsFromLineBody(text, editU, cancelU)
                const flexMessage = buildReservationFlexMessage({
                    bodyText,
                    editUrl: editU,
                    cancelUrl: cancelU,
                })
                const { ok, status, lineBody } = await lineMessagingPush({
                    tenantId,
                    toUserId: userId,
                    flexMessage,
                    kind: kind || "test",
                    reservationGroupId: reservationGroupId || null,
                })
                await pushLineToTenantAdmins({
                    tenantId,
                    adminUserIds,
                    excludeUserId: userId,
                    kind: kind || "test",
                    reservationGroupId: reservationGroupId || null,
                    flexMessage,
                })
                return NextResponse.json({
                    status: ok ? status : status || 500,
                    data: lineBody,
                })
            }
        } else {
            text = String(body.message || "")
        }

        const { ok, status, lineBody } = await lineMessagingPush({
            tenantId,
            toUserId: userId,
            text,
            kind: kind || "test",
            reservationGroupId: reservationGroupId || null,
        })

        if (adminUserIds.length > 0) {
            await pushLineToTenantAdmins({
                tenantId,
                adminUserIds,
                excludeUserId: userId,
                kind: kind || "test",
                reservationGroupId: reservationGroupId || null,
                text,
            })
        }

        return NextResponse.json({
            status: ok ? status : status || 500,
            data: lineBody,
        })
    } catch (err) {
        console.error("send-line API error:", err)
        return NextResponse.json({ error: "failed" }, { status: 500 })
    }
}
