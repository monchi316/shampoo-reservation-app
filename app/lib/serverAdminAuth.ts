import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { ADMIN_SESSION_COOKIE } from "@/app/lib/adminSessionConstants"
import { ensureTenantExists, normalizeTenantId } from "@/app/lib/serverTenantResolver"

const TOKEN_TTL_SEC = 60 * 60 * 24 * 7 // 7 days

export type AdminTokenPayload = {
    sub: string
    iat: number
    exp: number
}

/** superadmin=全店舗、owner=店舗設定まで可、staff=予約管理のみ */
export type AdminRole = "superadmin" | "owner" | "staff"

export type AdminAccess = {
    operatorId: string
    email: string
    displayName: string | null
    isSuperadmin: boolean
    role: AdminRole
    /** スーパー管理者は null（全 tenant 可） */
    tenantIds: string[] | null
}

function getSessionSecret(): string | null {
    const s = process.env.ADMIN_SESSION_SECRET
    if (typeof s !== "string" || s.length < 32) return null
    return s
}

export function signAdminSessionToken(operatorId: string): string | null {
    const secret = getSessionSecret()
    if (!secret) return null
    const iat = Math.floor(Date.now() / 1000)
    const exp = iat + TOKEN_TTL_SEC
    const payload: AdminTokenPayload = { sub: operatorId, iat, exp }
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
    const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url")
    return `${payloadB64}.${sig}`
}

export function verifyAdminSessionToken(token: string): AdminTokenPayload | null {
    const secret = getSessionSecret()
    if (!secret) return null
    const i = token.indexOf(".")
    if (i <= 0) return null
    const payloadB64 = token.slice(0, i)
    const sig = token.slice(i + 1)
    if (!payloadB64 || !sig) return null
    const expected = createHmac("sha256", secret).update(payloadB64).digest("base64url")
    if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
        return null
    }
    let payload: AdminTokenPayload
    try {
        payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as AdminTokenPayload
    } catch {
        return null
    }
    if (typeof payload.sub !== "string" || !payload.sub) return null
    const now = Math.floor(Date.now() / 1000)
    if (typeof payload.exp !== "number" || payload.exp < now) return null
    return payload
}

export function getAdminTokenFromRequest(req: NextRequest): string | null {
    return req.cookies.get(ADMIN_SESSION_COOKIE)?.value || null
}

export function createServiceSupabase(): SupabaseClient {
    return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/** scripts/phase2-hash-password.mjs と同じ scrypt 形式 */
export function hashPassword(plain: string): string {
    const salt = randomBytes(16)
    const key = scryptSync(plain, salt, 64)
    return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`
}

export function verifyPassword(plain: string, stored: string): boolean {
    const parts = stored.split("$")
    if (parts.length !== 3 || parts[0] !== "scrypt") return false
    try {
        const salt = Buffer.from(parts[1], "base64")
        const expected = Buffer.from(parts[2], "base64")
        const key = scryptSync(plain, salt, 64)
        if (key.length !== expected.length) return false
        return timingSafeEqual(key, expected)
    } catch {
        return false
    }
}

export async function loadAdminAccess(
    supabase: SupabaseClient,
    operatorId: string
): Promise<AdminAccess | null> {
    const { data: op, error } = await supabase
        .from("admin_operators")
        .select("id, email, display_name, is_active, is_superadmin, role")
        .eq("id", operatorId)
        .maybeSingle()

    if (error || !op || op.is_active === false) return null

    if (op.is_superadmin === true) {
        return {
            operatorId: op.id,
            email: op.email,
            displayName: op.display_name,
            isSuperadmin: true,
            role: "superadmin",
            tenantIds: null,
        }
    }

    const r = op.role as string | null
    if (r !== "owner" && r !== "staff") return null

    const { data: links, error: lErr } = await supabase
        .from("admin_operator_tenants")
        .select("tenant_id")
        .eq("operator_id", operatorId)

    if (lErr) return null
    const tenantIds = (links || [])
        .map((row) => row.tenant_id as string)
        .filter((id): id is string => typeof id === "string" && id.length > 0)

    return {
        operatorId: op.id,
        email: op.email,
        displayName: op.display_name,
        isSuperadmin: false,
        role: r as "owner" | "staff",
        tenantIds,
    }
}

export function canAccessTenant(access: AdminAccess, tenantId: string): boolean {
    if (access.isSuperadmin) return true
    return !!access.tenantIds?.includes(tenantId)
}

/** 店舗設定・メニュー・スケジュール・ロゴ・スタッフ管理 */
export function canManageTenantSettings(access: AdminAccess, tenantId: string): boolean {
    if (!canAccessTenant(access, tenantId)) return false
    if (access.role === "superadmin") return true
    return access.role === "owner"
}

/** LINE チャネル認証情報（LIFF / token 等）。運営スーパー管理者のみ。 */
export function canConfigureLineChannel(access: AdminAccess, tenantId: string): boolean {
    if (!canAccessTenant(access, tenantId)) return false
    return access.role === "superadmin"
}

/**
 * 一覧系 API 用: クエリの tenantId、またはオペレーターに店舗が1つだけならそれを採用。
 */
export async function resolveAdminListTenantId(
    supabase: SupabaseClient,
    access: AdminAccess,
    explicit: string | null
): Promise<{ ok: true; tenantId: string } | { ok: false; response: NextResponse }> {
    const normalized = normalizeTenantId(explicit)
    if (normalized) {
        if (!canAccessTenant(access, normalized)) {
            return {
                ok: false,
                response: jsonError("この店舗へのアクセスは許可されていません", 403),
            }
        }
        const exists = await ensureTenantExists(supabase, normalized)
        if (!exists) {
            return { ok: false, response: jsonError("tenant が見つかりません", 404) }
        }
        return { ok: true, tenantId: normalized }
    }

    if (access.isSuperadmin) {
        return { ok: false, response: jsonError("tenantId が必要です", 400) }
    }

    const allowed = access.tenantIds || []
    if (allowed.length === 0) {
        return { ok: false, response: jsonError("操作可能な店舗がありません", 403) }
    }
    if (allowed.length === 1) {
        return { ok: true, tenantId: allowed[0] }
    }
    return { ok: false, response: jsonError("tenantId が必要です（複数店舗に紐づいています）", 400) }
}

function jsonError(message: string, status: number): NextResponse {
    return NextResponse.json({ error: message }, { status })
}

export async function requireAdminSession(
    req: NextRequest
): Promise<
    | { ok: true; access: AdminAccess; supabase: SupabaseClient }
    | { ok: false; response: NextResponse }
> {
    const secret = getSessionSecret()
    if (!secret) {
        return { ok: false, response: jsonError("ADMIN_SESSION_SECRET が未設定です", 500) }
    }
    const token = getAdminTokenFromRequest(req)
    if (!token) {
        return { ok: false, response: jsonError("認証が必要です", 401) }
    }
    const payload = verifyAdminSessionToken(token)
    if (!payload) {
        return { ok: false, response: jsonError("セッションが無効です", 401) }
    }
    const supabase = createServiceSupabase()
    const access = await loadAdminAccess(supabase, payload.sub)
    if (!access) {
        return { ok: false, response: jsonError("認証が必要です", 401) }
    }
    return { ok: true, access, supabase }
}
