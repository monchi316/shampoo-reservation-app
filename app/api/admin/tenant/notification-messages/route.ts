import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseLineAdminNotifyUserIds, validateLineAdminNotifyUserIds } from "@/app/lib/lineAdminNotify"
import {
    canManageTenantSettings,
    requireAdminSession,
    resolveAdminListTenantId,
} from "@/app/lib/serverAdminAuth"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const SELECT_FIELDS =
    "reminder_enabled, reminder_template, line_message_template_reservation_complete, line_message_template_reservation_change, line_message_template_reservation_cancel, line_admin_notify_user_ids"

export async function GET(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "通知文面を閲覧する権限がありません" }, { status: 403 })
    }

    const { data: row, error } = await supabase
        .from("tenants")
        .select(SELECT_FIELDS)
        .eq("id", tenantId)
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
        tenantId,
        reminder_enabled: row?.reminder_enabled !== false,
        reminder_template: row?.reminder_template ?? "",
        line_message_template_reservation_complete: row?.line_message_template_reservation_complete ?? "",
        line_message_template_reservation_change: row?.line_message_template_reservation_change ?? "",
        line_message_template_reservation_cancel: row?.line_message_template_reservation_cancel ?? "",
        line_admin_notify_user_ids: parseLineAdminNotifyUserIds(row?.line_admin_notify_user_ids),
    })
}

export async function PUT(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "通知文面を変更する権限がありません" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const reminderEnabled = body?.reminder_enabled
    const reminderTemplateRaw = body?.reminder_template
    const completeRaw = body?.line_message_template_reservation_complete
    const changeRaw = body?.line_message_template_reservation_change
    const cancelRaw = body?.line_message_template_reservation_cancel
    const adminNotifyRaw = body?.line_admin_notify_user_ids

    if (reminderEnabled !== undefined && typeof reminderEnabled !== "boolean") {
        return NextResponse.json({ error: "reminder_enabled は boolean" }, { status: 400 })
    }
    for (const [key, val] of [
        ["reminder_template", reminderTemplateRaw],
        ["line_message_template_reservation_complete", completeRaw],
        ["line_message_template_reservation_change", changeRaw],
        ["line_message_template_reservation_cancel", cancelRaw],
    ] as const) {
        if (val !== undefined && val !== null && typeof val !== "string") {
            return NextResponse.json({ error: `${key} は文字列` }, { status: 400 })
        }
    }

    if (adminNotifyRaw !== undefined && adminNotifyRaw !== null) {
        if (!Array.isArray(adminNotifyRaw) && typeof adminNotifyRaw !== "string") {
            return NextResponse.json({ error: "line_admin_notify_user_ids は文字列配列" }, { status: 400 })
        }
        const parsed = parseLineAdminNotifyUserIds(adminNotifyRaw)
        const validationErr = validateLineAdminNotifyUserIds(parsed)
        if (validationErr) {
            return NextResponse.json({ error: validationErr }, { status: 400 })
        }
    }

    const patch: Record<string, unknown> = {}
    if (reminderEnabled !== undefined) patch.reminder_enabled = reminderEnabled
    if (reminderTemplateRaw !== undefined) {
        patch.reminder_template =
            typeof reminderTemplateRaw === "string" ? reminderTemplateRaw.slice(0, 2000).trim() || null : null
    }
    if (completeRaw !== undefined) {
        patch.line_message_template_reservation_complete =
            typeof completeRaw === "string" ? completeRaw.slice(0, 2000).trim() || null : null
    }
    if (changeRaw !== undefined) {
        patch.line_message_template_reservation_change =
            typeof changeRaw === "string" ? changeRaw.slice(0, 2000).trim() || null : null
    }
    if (cancelRaw !== undefined) {
        patch.line_message_template_reservation_cancel =
            typeof cancelRaw === "string" ? cancelRaw.slice(0, 2000).trim() || null : null
    }
    if (adminNotifyRaw !== undefined) {
        patch.line_admin_notify_user_ids = parseLineAdminNotifyUserIds(adminNotifyRaw)
    }

    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "更新フィールドがありません" }, { status: 400 })
    }

    const { error: upErr } = await supabase.from("tenants").update(patch).eq("id", tenantId)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    const { data: row } = await supabase.from("tenants").select(SELECT_FIELDS).eq("id", tenantId).maybeSingle()

    return NextResponse.json({
        tenantId,
        reminder_enabled: row?.reminder_enabled !== false,
        reminder_template: row?.reminder_template ?? "",
        line_message_template_reservation_complete: row?.line_message_template_reservation_complete ?? "",
        line_message_template_reservation_change: row?.line_message_template_reservation_change ?? "",
        line_message_template_reservation_cancel: row?.line_message_template_reservation_cancel ?? "",
        line_admin_notify_user_ids: parseLineAdminNotifyUserIds(row?.line_admin_notify_user_ids),
    })
}
