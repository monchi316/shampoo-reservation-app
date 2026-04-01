import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { canManageTenantSettings, requireAdminSession, resolveAdminListTenantId } from "@/app/lib/serverAdminAuth"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

type ReservationRow = {
    id: string
    date: string | null
    user_name: string | null
    maker: string | null
    model: string | null
    size: string | null
    sales_amount: number | null
    extra_fee: number | null
    service_done_at: string | null
    staff_name: string | null
}

export async function GET(req: NextRequest) {
    const auth = await requireAdminSession(req)
    if (!auth.ok) return auth.response

    const explicit = req.nextUrl.searchParams.get("tenantId")
    const resolved = await resolveAdminListTenantId(auth.supabase, auth.access, explicit)
    if (!resolved.ok) return resolved.response
    const tenantId = resolved.tenantId

    // スタッフは売上管理をできない（オーナー / スーパー管理者のみ）
    if (!canManageTenantSettings(auth.access, tenantId)) {
        return NextResponse.json({ error: "この機能に対する権限がありません" }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const from = sp.get("from")
    const to = sp.get("to")
    const format = sp.get("format")

    let query = supabase
        .from("reservations")
        .select("id, date, user_name, maker, model, size, sales_amount, extra_fee, service_done_at, staff_name")
        .eq("tenant_id", tenantId)
        .eq("status", "done")
        .order("service_done_at", { ascending: false })
        .limit(1000)

    if (from) query = query.gte("date", from)
    if (to) query = query.lte("date", to)

    const { data, error } = await query
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data || []) as ReservationRow[]
    const dailyMap = new Map<
        string,
        { date: string; count: number; sales_total: number; extra_total: number; grand_total: number }
    >()

    for (const row of rows) {
        const key = row.date || "unknown"
        const sales = Number(row.sales_amount || 0)
        const extra = Number(row.extra_fee || 0)
        const prev = dailyMap.get(key) || {
            date: key,
            count: 0,
            sales_total: 0,
            extra_total: 0,
            grand_total: 0,
        }
        prev.count += 1
        prev.sales_total += sales
        prev.extra_total += extra
        prev.grand_total += sales + extra
        dailyMap.set(key, prev)
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1))

    const monthMap = new Map<
        string,
        { month: string; count: number; sales_total: number; extra_total: number; grand_total: number }
    >()
    const staffMap = new Map<
        string,
        { staff_name: string; count: number; sales_total: number; extra_total: number; grand_total: number }
    >()

    for (const row of rows) {
        const dateKey = row.date || "unknown"
        const monthKey = dateKey === "unknown" ? "unknown" : dateKey.slice(0, 7)
        const staffKey = row.staff_name || "未設定"
        const sales = Number(row.sales_amount || 0)
        const extra = Number(row.extra_fee || 0)

        const monthPrev = monthMap.get(monthKey) || {
            month: monthKey,
            count: 0,
            sales_total: 0,
            extra_total: 0,
            grand_total: 0,
        }
        monthPrev.count += 1
        monthPrev.sales_total += sales
        monthPrev.extra_total += extra
        monthPrev.grand_total += sales + extra
        monthMap.set(monthKey, monthPrev)

        const staffPrev = staffMap.get(staffKey) || {
            staff_name: staffKey,
            count: 0,
            sales_total: 0,
            extra_total: 0,
            grand_total: 0,
        }
        staffPrev.count += 1
        staffPrev.sales_total += sales
        staffPrev.extra_total += extra
        staffPrev.grand_total += sales + extra
        staffMap.set(staffKey, staffPrev)
    }

    const monthly = Array.from(monthMap.values()).sort((a, b) => (a.month < b.month ? 1 : -1))
    const byStaff = Array.from(staffMap.values()).sort((a, b) => b.grand_total - a.grand_total)

    if (format === "csv") {
        const header = [
            "id",
            "date",
            "service_done_at",
            "staff_name",
            "user_name",
            "maker",
            "model",
            "size",
            "sales_amount",
            "extra_fee",
            "grand_total",
        ].join(",")

        const lines = rows.map((r) => {
            const sales = Number(r.sales_amount || 0)
            const extra = Number(r.extra_fee || 0)
            const grand = sales + extra
            const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`
            return [
                esc(r.id),
                esc(r.date),
                esc(r.service_done_at),
                esc(r.staff_name || "未設定"),
                esc(r.user_name),
                esc(r.maker),
                esc(r.model),
                esc(r.size),
                esc(sales),
                esc(extra),
                esc(grand),
            ].join(",")
        })

        const csv = [header, ...lines].join("\n")
        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="sales.csv"`,
            },
        })
    }

    return NextResponse.json({
        rows,
        daily,
        monthly,
        byStaff,
    })
}
