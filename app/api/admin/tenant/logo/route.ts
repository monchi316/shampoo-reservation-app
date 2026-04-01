import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
    canManageTenantSettings,
    requireAdminSession,
    resolveAdminListTenantId,
} from "@/app/lib/serverAdminAuth"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const BUCKET = "tenant-logos"

function isMissingLogoColumn(error: unknown) {
    const e = error as { code?: string; message?: string } | null
    return e?.code === "42703" || (e?.message || "").includes("logo_path")
}

function mimeToExt(mime: string | null | undefined) {
    const m = (mime || "").toLowerCase()
    if (m.includes("png")) return "png"
    if (m.includes("jpeg") || m.includes("jpg")) return "jpg"
    if (m.includes("webp")) return "webp"
    return "png"
}

function extFromFilename(name: string | null | undefined) {
    const n = (name || "").toLowerCase()
    if (n.endsWith(".png")) return "png"
    if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpg"
    if (n.endsWith(".webp")) return "webp"
    return null
}

async function ensureBucket() {
    try {
        await supabase.storage.getBucket(BUCKET)
        return
    } catch {
        // ignore
    }

    try {
        await supabase.storage.createBucket(BUCKET, { public: true })
    } catch (e) {
        throw e
    }
}

async function resolveLogoUrl(path: string) {
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)
    if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl || null
}

export async function GET(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "ロゴを閲覧する権限がありません" }, { status: 403 })
    }

    const { data: tenant, error } = await supabase
        .from("tenants")
        .select("logo_path")
        .eq("id", tenantId)
        .maybeSingle()

    if (error) {
        if (isMissingLogoColumn(error)) {
            return NextResponse.json({ logoPath: null, logoUrl: null, tenantId })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const logoPath = tenant?.logo_path as string | null
    if (!logoPath) return NextResponse.json({ logoPath: null, logoUrl: null, tenantId })

    const logoUrl = await resolveLogoUrl(logoPath)
    return NextResponse.json({ logoPath, logoUrl, tenantId })
}

export async function POST(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "ロゴを変更する権限がありません" }, { status: 403 })
    }

    try {
        await ensureBucket()
    } catch (e) {
        console.error("ensureBucket failed", e)
        return NextResponse.json(
            { error: "Storage bucket の用意に失敗しました", detail: (e as any)?.message || String(e) },
            { status: 500 }
        )
    }

    const formData = await req.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "file をアップロードしてください" }, { status: 400 })
    }

    const maxBytes = 5 * 1024 * 1024
    if (file.size > maxBytes) {
        return NextResponse.json({ error: "ファイルサイズが大きすぎます（5MB以下にしてください）" }, { status: 400 })
    }

    const byMime = String(file.type || "").startsWith("image/")
    const byExt = !!extFromFilename(file.name)
    if (!byMime && !byExt) {
        return NextResponse.json(
            { error: "画像ファイルのみ対応です（png/jpg/webp）" },
            { status: 400 }
        )
    }

    const ext = extFromFilename(file.name) || mimeToExt(file.type)
    const logoPath = `${tenantId}/logo.${ext}`

    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(logoPath, file, {
        upsert: true,
        contentType: file.type || "image/png",
    })

    if (uploadErr) {
        console.error("logo upload failed", uploadErr)
        return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    const { error: upErr } = await supabase
        .from("tenants")
        .update({ logo_path: logoPath })
        .eq("id", tenantId)

    if (upErr) {
        if (isMissingLogoColumn(upErr)) {
            return NextResponse.json(
                { error: "DBマイグレーション未適用です。tenants.logo_path を追加してください。" },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    const logoUrl = await resolveLogoUrl(logoPath)
    return NextResponse.json({ logoPath, logoUrl, tenantId })
}

export async function DELETE(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "ロゴを変更する権限がありません" }, { status: 403 })
    }

    const { data: tenant, error } = await supabase
        .from("tenants")
        .select("logo_path")
        .eq("id", tenantId)
        .maybeSingle()

    if (error) {
        if (isMissingLogoColumn(error)) return NextResponse.json({ ok: true })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const logoPath = (tenant?.logo_path as string | null) || null

    if (logoPath) {
        try {
            await supabase.storage.from(BUCKET).remove([logoPath])
        } catch {
            // ignore
        }
    }

    const { error: upErr } = await supabase
        .from("tenants")
        .update({ logo_path: null })
        .eq("id", tenantId)

    if (upErr) {
        if (isMissingLogoColumn(upErr)) return NextResponse.json({ ok: true })
        return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
