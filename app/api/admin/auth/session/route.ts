import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/app/lib/serverAdminAuth"

export async function GET(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const { access, supabase } = auth

    let tenants: { id: string; name: string }[] = []
    if (access.isSuperadmin) {
        const { data, error } = await supabase.from("tenants").select("id, name").order("name", { ascending: true })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        tenants = (data || []).map((r) => ({ id: r.id as string, name: (r.name as string) || "" }))
    } else {
        const ids = access.tenantIds || []
        if (ids.length === 0) {
            tenants = []
        } else {
            const { data, error } = await supabase.from("tenants").select("id, name").in("id", ids)
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            tenants = (data || []).map((r) => ({ id: r.id as string, name: (r.name as string) || "" }))
            tenants.sort((a, b) => a.name.localeCompare(b.name, "ja"))
        }
    }

    return NextResponse.json({
        operator: {
            id: access.operatorId,
            email: access.email,
            displayName: access.displayName,
            isSuperadmin: access.isSuperadmin,
            role: access.role,
        },
        tenants,
    })
}
