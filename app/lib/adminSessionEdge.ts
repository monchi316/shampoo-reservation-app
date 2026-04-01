/**
 * Edge middleware 用: admin_session Cookie の HMAC 検証（Node の serverAdminAuth と同一形式）
 */
export type AdminTokenPayload = {
    sub: string
    iat: number
    exp: number
}

function base64UrlToBytes(b64url: string): Uint8Array {
    const padded = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4)
    const bin = atob(padded)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let bin = ""
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    const b64 = btoa(bin)
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    let x = 0
    for (let i = 0; i < a.length; i++) x |= a[i] ^ b[i]
    return x === 0
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    )
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message))
    return bytesToBase64Url(new Uint8Array(sig))
}

export async function verifyAdminSessionTokenEdge(
    token: string,
    secret: string
): Promise<AdminTokenPayload | null> {
    if (secret.length < 32) return null
    const i = token.indexOf(".")
    if (i <= 0) return null
    const payloadB64 = token.slice(0, i)
    const sig = token.slice(i + 1)
    if (!payloadB64 || !sig) return null
    const expectedSig = await hmacSha256Base64Url(secret, payloadB64)
    const sigBytes = base64UrlToBytes(sig)
    const expBytes = base64UrlToBytes(expectedSig)
    if (!timingSafeEqualBytes(sigBytes, expBytes)) return null
    try {
        const json = new TextDecoder().decode(base64UrlToBytes(payloadB64))
        const payload = JSON.parse(json) as AdminTokenPayload
        if (typeof payload.sub !== "string" || !payload.sub) return null
        const now = Math.floor(Date.now() / 1000)
        if (typeof payload.exp !== "number" || payload.exp < now) return null
        return payload
    } catch {
        return null
    }
}
