import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { verifyAdminSessionTokenEdge } from "@/app/lib/adminSessionEdge"
import { ADMIN_SESSION_COOKIE } from "@/app/lib/adminSessionConstants"

export const config = {
    matcher: ["/admin", "/admin/:path*"],
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    if (pathname === "/admin/login") {
        return NextResponse.next()
    }

    const secret = process.env.ADMIN_SESSION_SECRET
    if (typeof secret !== "string" || secret.length < 32) {
        return NextResponse.redirect(new URL("/admin/login", request.url))
    }

    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
    if (!token) {
        const from = pathname + request.nextUrl.search
        return NextResponse.redirect(new URL(`/admin/login?from=${encodeURIComponent(from)}`, request.url))
    }

    const payload = await verifyAdminSessionTokenEdge(token, secret)
    if (!payload) {
        const from = pathname + request.nextUrl.search
        return NextResponse.redirect(new URL(`/admin/login?from=${encodeURIComponent(from)}`, request.url))
    }

    return NextResponse.next()
}
