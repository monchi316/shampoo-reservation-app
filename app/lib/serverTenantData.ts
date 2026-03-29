import type { SupabaseClient } from "@supabase/supabase-js"
import type { ExceptionRow, ExistingReservationSlot, SchedulingSettings, WeeklyRow } from "./scheduling"
import { canBookSlot, getEffectiveBusinessWindow, normalizeDbTimeValue, timeStrToMinutes } from "./scheduling"

function normalizeDbDateOnly(v: unknown): string {
    if (v == null) return ""
    const s = String(v)
    return s.length >= 10 ? s.slice(0, 10) : s
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
        weekly: (w || []).map((r: any) => ({
            day_of_week: r.day_of_week,
            is_closed: r.is_closed,
            open_time: normalizeDbTimeValue(r.open_time),
            close_time: normalizeDbTimeValue(r.close_time),
        })),
        exceptions: (ex || []).map((r: any) => ({
            exception_date: normalizeDbDateOnly(r.exception_date),
            is_closed: r.is_closed,
            open_time: normalizeDbTimeValue(r.open_time),
            close_time: normalizeDbTimeValue(r.close_time),
        })),
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
