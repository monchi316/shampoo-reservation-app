import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
    canConfigureLineChannel,
    requireAdminSession,
    resolveAdminListTenantId,
} from "@/app/lib/serverAdminAuth"
import {
    encryptLineCredential,
    isLineCredentialEncryptionConfigured,
} from "@/app/lib/secureLineCredentials"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type TenantChannelRow = {
    id: string
    tenant_id: string
    channel_type: string
    liff_id: string | null
    is_active: boolean
    line_channel_id: string | null
    line_channel_secret_enc: string | null
    line_channel_access_token_enc: string | null
    line_push_enabled: boolean
    line_token_last4: string | null
    line_token_updated_at: string | null
    created_at: string
    updated_at: string
}

async function getCurrentTenantChannel(tenantId: string): Promise<TenantChannelRow | null> {
    const { data, error } = await supabase
        .from("tenant_channels")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("channel_type", "line_liff")
        .order("updated_at", { ascending: false })
        .limit(1)
    if (error) throw error
    return ((data || [])[0] as TenantChannelRow | undefined) || null
}

export async function GET(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canConfigureLineChannel(auth.access, tenantId)) {
        return NextResponse.json({ error: "LINE接続設定は運営（スーパー管理者）のみ閲覧できます" }, { status: 403 })
    }

    try {
        const row = await getCurrentTenantChannel(tenantId)
        if (!row) {
            return NextResponse.json({
                tenantId,
                configured: false,
                liff_id: null,
                line_channel_id: null,
                line_push_enabled: true,
                line_token_last4: null,
                line_token_updated_at: null,
                has_access_token: false,
                has_channel_secret: false,
                encryption_ready: isLineCredentialEncryptionConfigured(),
            })
        }

        return NextResponse.json({
            tenantId,
            configured: !!row.line_channel_access_token_enc,
            liff_id: row.liff_id || null,
            line_channel_id: row.line_channel_id || null,
            line_push_enabled: row.line_push_enabled !== false,
            line_token_last4: row.line_token_last4 || null,
            line_token_updated_at: row.line_token_updated_at || null,
            has_access_token: !!row.line_channel_access_token_enc,
            has_channel_secret: !!row.line_channel_secret_enc,
            encryption_ready: isLineCredentialEncryptionConfigured(),
        })
    } catch (e) {
        const msg = (e as { message?: string } | null)?.message || "取得に失敗しました"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

export async function PUT(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canConfigureLineChannel(auth.access, tenantId)) {
        return NextResponse.json({ error: "LINE接続設定は運営（スーパー管理者）のみ変更できます" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const liffIdRaw = body?.liff_id
    const channelIdRaw = body?.line_channel_id
    const channelSecretRaw = body?.line_channel_secret
    const accessTokenRaw = body?.line_channel_access_token
    const linePushEnabledRaw = body?.line_push_enabled
    const isActiveRaw = body?.is_active

    if (linePushEnabledRaw !== undefined && typeof linePushEnabledRaw !== "boolean") {
        return NextResponse.json({ error: "line_push_enabled は boolean" }, { status: 400 })
    }
    if (isActiveRaw !== undefined && typeof isActiveRaw !== "boolean") {
        return NextResponse.json({ error: "is_active は boolean" }, { status: 400 })
    }
    if (liffIdRaw !== undefined && liffIdRaw !== null && typeof liffIdRaw !== "string") {
        return NextResponse.json({ error: "liff_id は文字列" }, { status: 400 })
    }
    if (channelIdRaw !== undefined && channelIdRaw !== null && typeof channelIdRaw !== "string") {
        return NextResponse.json({ error: "line_channel_id は文字列" }, { status: 400 })
    }
    if (channelSecretRaw !== undefined && channelSecretRaw !== null && typeof channelSecretRaw !== "string") {
        return NextResponse.json({ error: "line_channel_secret は文字列" }, { status: 400 })
    }
    if (accessTokenRaw !== undefined && accessTokenRaw !== null && typeof accessTokenRaw !== "string") {
        return NextResponse.json({ error: "line_channel_access_token は文字列" }, { status: 400 })
    }

    const liffId = typeof liffIdRaw === "string" ? liffIdRaw.trim() : undefined
    const lineChannelId = typeof channelIdRaw === "string" ? channelIdRaw.trim() : undefined
    const lineChannelSecret = typeof channelSecretRaw === "string" ? channelSecretRaw.trim() : undefined
    const lineChannelAccessToken = typeof accessTokenRaw === "string" ? accessTokenRaw.trim() : undefined

    if ((lineChannelSecret || lineChannelAccessToken) && !isLineCredentialEncryptionConfigured()) {
        return NextResponse.json(
            { error: "LINE_CREDENTIALS_ENCRYPTION_KEY が未設定です（32文字以上）" },
            { status: 500 }
        )
    }

    const patch: Record<string, unknown> = {
        tenant_id: tenantId,
        channel_type: "line_liff",
    }
    if (liffId !== undefined) patch.liff_id = liffId || null
    if (lineChannelId !== undefined) patch.line_channel_id = lineChannelId || null
    if (linePushEnabledRaw !== undefined) patch.line_push_enabled = linePushEnabledRaw
    if (isActiveRaw !== undefined) patch.is_active = isActiveRaw
    if (lineChannelSecret) {
        patch.line_channel_secret_enc = encryptLineCredential(lineChannelSecret)
    }
    if (lineChannelAccessToken) {
        patch.line_channel_access_token_enc = encryptLineCredential(lineChannelAccessToken)
        patch.line_token_last4 = lineChannelAccessToken.slice(-4)
        patch.line_token_updated_at = new Date().toISOString()
    }

    // (tenant_id, channel_type) の UNIQUE が無い DB でも動かす（マイグレーション未適用対策）
    const { data: existingUpsertRows, error: selUpsertErr } = await supabase
        .from("tenant_channels")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("channel_type", "line_liff")
        .order("updated_at", { ascending: false })
        .limit(1)

    if (selUpsertErr) {
        return NextResponse.json({ error: selUpsertErr.message }, { status: 500 })
    }

    const existingUpsertId = (existingUpsertRows?.[0] as { id?: string } | undefined)?.id

    if (existingUpsertId) {
        const { error: upErr } = await supabase
            .from("tenant_channels")
            .update(patch)
            .eq("id", existingUpsertId)
        if (upErr) {
            return NextResponse.json({ error: upErr.message }, { status: 500 })
        }
    } else {
        const insertPayload: Record<string, unknown> = {
            ...patch,
            is_active: patch.is_active !== undefined ? patch.is_active : true,
            line_push_enabled: patch.line_push_enabled !== undefined ? patch.line_push_enabled : true,
        }
        if (insertPayload.liff_id === null || insertPayload.liff_id === undefined) {
            insertPayload.liff_id = ""
        }
        const { error: insErr } = await supabase.from("tenant_channels").insert(insertPayload)
        if (insErr) {
            return NextResponse.json({ error: insErr.message }, { status: 500 })
        }
    }

    try {
        const row = await getCurrentTenantChannel(tenantId)
        return NextResponse.json({
            ok: true,
            tenantId,
            configured: !!row?.line_channel_access_token_enc,
            liff_id: row?.liff_id || null,
            line_channel_id: row?.line_channel_id || null,
            line_push_enabled: row?.line_push_enabled !== false,
            line_token_last4: row?.line_token_last4 || null,
            line_token_updated_at: row?.line_token_updated_at || null,
            has_access_token: !!row?.line_channel_access_token_enc,
            has_channel_secret: !!row?.line_channel_secret_enc,
        })
    } catch (e) {
        const msg = (e as { message?: string } | null)?.message || "保存に失敗しました"
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

