import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    try {
        const res = await fetch(`${process.env.CANCEL_URL_BASE}?id=${id}`, {
            headers: {
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
        })

        const text = await res.text()
        return new NextResponse(text, { status: res.status })
    } catch (err) {
        console.error("Cancel error:", err)
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
    }
}