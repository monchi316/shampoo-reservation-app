import { createClient } from "@supabase/supabase-js"
import { decryptLineCredential } from "@/app/lib/secureLineCredentials"

type LinePushKind = "reservation_created" | "reservation_updated" | "cancelled" | "reminder" | "test"

type LinePushParams = {
    tenantId: string
    toUserId: string
    text: string
    kind?: LinePushKind
    reservationGroupId?: string | null
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function logDelivery(params: {
    tenantId: string
    kind: LinePushKind
    toUserId: string
    ok: boolean
    statusCode: number
    errorBody: unknown
    reservationGroupId?: string | null
}) {
    try {
        await supabase.from("line_delivery_logs").insert({
            tenant_id: params.tenantId,
            kind: params.kind,
            to_user_id: params.toUserId,
            status_code: params.statusCode || null,
            ok: params.ok,
            error_body: params.ok ? null : JSON.stringify(params.errorBody || {}),
            reservation_group_id: params.reservationGroupId || null,
        })
    } catch {
        // logs table未作成環境でも通知本体は継続
    }
}

async function resolveTenantLineToken(tenantId: string): Promise<{ token: string | null; reason?: string }> {
    const fallback = process.env.LINE_CHANNEL_ACCESS_TOKEN || null
    const { data, error } = await supabase
        .from("tenant_channels")
        .select("is_active, line_push_enabled, line_channel_access_token_enc")
        .eq("tenant_id", tenantId)
        .eq("channel_type", "line_liff")
        .order("updated_at", { ascending: false })
        .limit(1)

    if (error) return { token: fallback, reason: error.message }
    const row = (data || [])[0] as
        | {
              is_active?: boolean
              line_push_enabled?: boolean
              line_channel_access_token_enc?: string | null
          }
        | undefined
    if (!row) return { token: fallback, reason: fallback ? "fallback token used: tenant channel not configured" : "tenant channel not configured" }
    if (row.is_active === false) return { token: null, reason: "tenant channel is inactive" }
    if (row.line_push_enabled === false) return { token: null, reason: "line push disabled by tenant setting" }
    if (!row.line_channel_access_token_enc) {
        return {
            token: fallback,
            reason: fallback ? "fallback token used: tenant line access token not set" : "tenant line access token not set",
        }
    }
    try {
        return { token: decryptLineCredential(row.line_channel_access_token_enc) }
    } catch (e) {
        return {
            token: fallback,
            reason:
                (e as { message?: string } | null)?.message ||
                (fallback ? "fallback token used: token decrypt failed" : "token decrypt failed"),
        }
    }
}

/**
 * LINE Messaging API で tenant ごとの push 通知を送る。
 */
export async function lineMessagingPush(
    params: LinePushParams
): Promise<{ ok: boolean; status: number; lineBody: unknown }> {
    const tenantId = String(params.tenantId || "").trim()
    const toUserId = String(params.toUserId || "").trim()
    const text = String(params.text || "")
    const kind = params.kind || "test"
    const reservationGroupId = params.reservationGroupId || null

    if (!tenantId || !toUserId || !text) {
        const body = { skipped: true, reason: "tenantId/toUserId/text is required" }
        await logDelivery({
            tenantId: tenantId || "00000000-0000-4000-8000-000000000001",
            kind,
            toUserId: toUserId || "",
            ok: false,
            statusCode: 0,
            errorBody: body,
            reservationGroupId,
        })
        return { ok: false, status: 0, lineBody: body }
    }

    const resolved = await resolveTenantLineToken(tenantId)
    if (!resolved.token) {
        const body = { skipped: true, reason: resolved.reason || "token not available" }
        await logDelivery({
            tenantId,
            kind,
            toUserId,
            ok: false,
            statusCode: 0,
            errorBody: body,
            reservationGroupId,
        })
        return { ok: false, status: 0, lineBody: body }
    }

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resolved.token}`,
        },
        body: JSON.stringify({
            to: toUserId,
            messages: [{ type: "text", text }],
        }),
    })

    const lineBody = await res.json().catch(() => ({}))
    await logDelivery({
        tenantId,
        kind,
        toUserId,
        ok: res.ok,
        statusCode: res.status,
        errorBody: lineBody,
        reservationGroupId,
    })
    if (!res.ok) {
        console.error("LINE push failed", res.status, lineBody)
    }
    return { ok: res.ok, status: res.status, lineBody }
}
