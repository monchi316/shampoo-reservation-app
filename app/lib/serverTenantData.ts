import type { SupabaseClient } from "@supabase/supabase-js"
import type { ExceptionRow, ExistingReservationSlot, SchedulingSettings, WeeklyRow } from "./scheduling"
import { canBookSlot, getEffectiveBusinessWindow, normalizeDbTimeValue, timeStrToMinutes } from "./scheduling"

function normalizeDbDateOnly(v: unknown): string {
    if (v == null) return ""
    const s = String(v)
    return s.length >= 10 ? s.slice(0, 10) : s
}

function toJstDateTimeMs(dateStr: string, timeStr: string): number | null {
    const normalizedTime = /^\d{1,2}:\d{2}$/.test(timeStr) ? `${timeStr}:00` : timeStr
    const ms = Date.parse(`${dateStr}T${normalizedTime}+09:00`)
    return Number.isFinite(ms) ? ms : null
}

function getBookingLeadMs(settings: SchedulingSettings): number {
    const days = Math.max(0, Number(settings.booking_lead_days || 0))
    const hours = Math.max(0, Number(settings.booking_lead_hours || 0))
    return (days * 24 + hours) * 60 * 60 * 1000
}

function isBeforeBookingLead(dateStr: string, timeStr: string, settings: SchedulingSettings): boolean {
    const startMs = toJstDateTimeMs(dateStr, timeStr)
    if (startMs === null) return true
    const minAllowedMs = Date.now() + getBookingLeadMs(settings)
    return startMs < minAllowedMs
}

function bookingLeadLabel(settings: SchedulingSettings): string {
    const days = Math.max(0, Number(settings.booking_lead_days || 0))
    const hours = Math.max(0, Number(settings.booking_lead_hours || 0))
    return `${days}日${hours}時間`
}

function getJstDateMidnightMs(dateStr: string): number | null {
    const ms = Date.parse(`${dateStr}T00:00:00+09:00`)
    return Number.isFinite(ms) ? ms : null
}

function addDaysJst(dateStr: string, addDays: number): string | null {
    const midnightMs = getJstDateMidnightMs(dateStr)
    if (midnightMs === null) return null
    const ms = midnightMs + addDays * 24 * 60 * 60 * 1000
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
    return fmt.format(new Date(ms))
}

export async function loadSchedulingBundle(
    supabase: SupabaseClient,
    tenantId: string
): Promise<{
    settings: SchedulingSettings | null
    weekly: WeeklyRow[]
    exceptions: ExceptionRow[]
}> {
    const { data: row } = await supabase
        .from("tenant_scheduling_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle()

    const settings: SchedulingSettings | null = row
        ? {
              business_hours_mode: row.business_hours_mode,
              uniform_open: normalizeDbTimeValue(row.uniform_open),
              uniform_close: normalizeDbTimeValue(row.uniform_close),
              avg_service_minutes_per_car: row.avg_service_minutes_per_car,
              avg_travel_minutes: row.avg_travel_minutes,
              booking_lead_days: row.booking_lead_days ?? 0,
              booking_lead_hours: row.booking_lead_hours ?? 0,
          }
        : null

    const { data: w } = await supabase
        .from("business_hours_weekly")
        .select("day_of_week, is_closed, open_time, close_time")
        .eq("tenant_id", tenantId)

    const { data: ex } = await supabase
        .from("business_hours_exceptions")
        .select("exception_date, is_closed, open_time, close_time")
        .eq("tenant_id", tenantId)

    return {
        settings,
        weekly: (w || []).map(
            (r: {
                day_of_week: number
                is_closed: boolean
                open_time: unknown
                close_time: unknown
            }) => ({
            day_of_week: r.day_of_week,
            is_closed: r.is_closed,
            open_time: normalizeDbTimeValue(r.open_time),
            close_time: normalizeDbTimeValue(r.close_time),
        })
        ),
        exceptions: (ex || []).map(
            (r: {
                exception_date: unknown
                is_closed: boolean
                open_time: unknown
                close_time: unknown
            }) => ({
            exception_date: normalizeDbDateOnly(r.exception_date),
            is_closed: r.is_closed,
            open_time: normalizeDbTimeValue(r.open_time),
            close_time: normalizeDbTimeValue(r.close_time),
        })
        ),
    }
}

/** 予約枠が取れるか（サーバー側の最終判定。RLS のない service クライアントで使う） */
export async function assertReservationSlotAvailable(
    supabase: SupabaseClient,
    params: {
        tenantId: string
        dateStr: string
        timeStr: string
        numCars: number
        excludeGroupId?: string | null
        /** 単体予約の変更時など、該当行 id を既存枠から除外 */
        excludeReservationIds?: string[] | null
    }
): Promise<{ ok: true } | { ok: false; reason: string }> {
    const { tenantId, dateStr, timeStr, numCars, excludeGroupId, excludeReservationIds } = params
    const { settings, weekly, exceptions } = await loadSchedulingBundle(supabase, tenantId)
    if (!settings) {
        return { ok: false, reason: "スケジュール設定がありません。店舗へお問い合わせください。" }
    }
    if (isBeforeBookingLead(dateStr, timeStr, settings)) {
        return {
            ok: false,
            reason: `開始時刻は現在から ${bookingLeadLabel(settings)} 後以降で指定してください。`,
        }
    }
    const window = getEffectiveBusinessWindow(dateStr, settings, weekly, exceptions)
    const existing = await loadExistingReservationSlots(
        supabase,
        tenantId,
        dateStr,
        settings.avg_service_minutes_per_car,
        excludeGroupId,
        excludeReservationIds
    )
    return canBookSlot({
        dateStr,
        timeStr,
        numCars,
        window,
        serviceMinutesPerCar: settings.avg_service_minutes_per_car,
        travelMinutes: settings.avg_travel_minutes,
        existing,
    })
}

function minutesToTimeStr(totalMin: number): string {
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * 指定日の予約可能な開始時刻候補を返す（既存予約・移動時間・営業時間を考慮）。
 * 予約フォームの可視化用途。最終的な登録可否は assertReservationSlotAvailable で再確認する。
 */
export async function listAvailableStartTimes(
    supabase: SupabaseClient,
    params: {
        tenantId: string
        dateStr: string
        numCars: number
        stepMinutes?: number
        excludeGroupId?: string | null
        excludeReservationIds?: string[] | null
    }
): Promise<
    | {
          ok: true
          times: string[]
          openTime: string | null
          closeTime: string | null
          earliestStartDate?: string | null
          earliestStartTime?: string | null
          reason?: string
      }
    | { ok: false; reason: string }
> {
    const {
        tenantId,
        dateStr,
        numCars,
        stepMinutes = 30,
        excludeGroupId,
        excludeReservationIds,
    } = params
    const { settings, weekly, exceptions } = await loadSchedulingBundle(supabase, tenantId)
    if (!settings) {
        return { ok: false, reason: "スケジュール設定がありません。店舗へお問い合わせください。" }
    }

    const window = getEffectiveBusinessWindow(dateStr, settings, weekly, exceptions)

    const existing = window
        ? await loadExistingReservationSlots(
              supabase,
              tenantId,
              dateStr,
              settings.avg_service_minutes_per_car,
              excludeGroupId,
              excludeReservationIds
          )
        : []

    const times: string[] = []
    if (window) {
        for (let start = window.openMin; start < window.closeMin; start += stepMinutes) {
            const t = minutesToTimeStr(start)
            if (isBeforeBookingLead(dateStr, t, settings)) continue
            const result = canBookSlot({
                dateStr,
                timeStr: t,
                numCars,
                window,
                serviceMinutesPerCar: settings.avg_service_minutes_per_car,
                travelMinutes: settings.avg_travel_minutes,
                existing,
            })
            if (result.ok) times.push(t)
        }
    }

    // 候補が0件なら「最短で取れる日時」を別日も含めて探す
    // （入力補助なので、ここでの探索は上限日数を設けて負荷を抑える）
    let earliest: { date: string; time: string } | null = null
    if (times.length === 0) {
        const maxSearchDays = 14
        for (let offset = 0; offset <= maxSearchDays; offset++) {
            const scanDate = addDaysJst(dateStr, offset)
            if (!scanDate) break
            const scanWindow =
                offset === 0 ? window : getEffectiveBusinessWindow(scanDate, settings, weekly, exceptions)
            if (!scanWindow) continue

            const scanExisting =
                offset === 0
                    ? existing
                    : await loadExistingReservationSlots(
                          supabase,
                          tenantId,
                          scanDate,
                          settings.avg_service_minutes_per_car,
                          excludeGroupId,
                          excludeReservationIds
                      )

            for (let start = scanWindow.openMin; start < scanWindow.closeMin; start += stepMinutes) {
                const t = minutesToTimeStr(start)
                if (isBeforeBookingLead(scanDate, t, settings)) continue
                const result = canBookSlot({
                    dateStr: scanDate,
                    timeStr: t,
                    numCars,
                    window: scanWindow,
                    serviceMinutesPerCar: settings.avg_service_minutes_per_car,
                    travelMinutes: settings.avg_travel_minutes,
                    existing: scanExisting,
                })
                if (result.ok) {
                    earliest = { date: scanDate, time: t }
                    break
                }
            }
            if (earliest) break
        }
    }

    return {
        ok: true,
        times,
        openTime: window ? minutesToTimeStr(window.openMin) : null,
        closeTime: window ? minutesToTimeStr(window.closeMin) : null,
        earliestStartDate: times.length === 0 ? earliest?.date ?? null : undefined,
        earliestStartTime: times.length === 0 ? earliest?.time ?? null : undefined,
        reason:
            times.length === 0
                ? window
                    ? "予約枠に空きがありません。別日または台数の調整をご検討ください。"
                    : "この日は休業です。別日をご検討ください。"
                : undefined,
    }
}

/** 同日・同一テナントの予約をグループ化し、サービス占有区間（分）を返す */
export async function loadExistingReservationSlots(
    supabase: SupabaseClient,
    tenantId: string,
    dateStr: string,
    serviceMinutesPerCar: number,
    excludeGroupId?: string | null,
    excludeReservationIds?: string[] | null
): Promise<ExistingReservationSlot[]> {
    const { data: rows, error } = await supabase
        .from("reservations")
        .select("id, group_id, time")
        .eq("tenant_id", tenantId)
        .eq("date", dateStr)
        .neq("status", "cancelled")

    if (error || !rows?.length) return []

    const skipIds = new Set(excludeReservationIds?.filter(Boolean) || [])
    const map = new Map<string, { time: string; count: number }>()
    for (const r of rows as { id: string; group_id: string | null; time: string | null }[]) {
        if (excludeGroupId && r.group_id === excludeGroupId) continue
        if (skipIds.has(r.id)) continue
        const key = r.group_id || r.id
        const t = normalizeDbTimeValue(r.time) || "00:00"
        const cur = map.get(key)
        if (cur) {
            cur.count += 1
        } else {
            map.set(key, { time: t, count: 1 })
        }
    }

    const out: ExistingReservationSlot[] = []
    for (const { time, count } of map.values()) {
        const startMin = timeStrToMinutes(time)
        if (startMin === null) continue
        const endMin = startMin + count * serviceMinutesPerCar
        out.push({ startMin, endMin })
    }
    return out
}
