/**
 * 営業時間・既存予約と移動バッファから、指定日時に N 台予約可能か判定する純関数。
 * 時刻は「その日の 0 時からの分」で比較（DB の date / time と同じ前提）。
 */

export type WeeklyRow = {
    day_of_week: number
    is_closed: boolean
    open_time: string | null
    close_time: string | null
}

export type ExceptionRow = {
    exception_date: string
    is_closed: boolean
    open_time: string | null
    close_time: string | null
}

export type SchedulingSettings = {
    business_hours_mode: "uniform" | "weekly"
    uniform_open: string | null
    uniform_close: string | null
    avg_service_minutes_per_car: number
    avg_travel_minutes: number
}

export function timeStrToMinutes(t: string | null | undefined): number | null {
    if (!t || typeof t !== "string") return null
    const parts = t.trim().split(":")
    if (parts.length < 2) return null
    const h = Number(parts[0])
    const m = Number(parts[1])
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
}

/** DB / API から来る time を HH:MM に揃える（秒・タイムゾーン付きでも先頭の時分だけ使う） */
export function normalizeDbTimeValue(v: unknown): string | null {
    if (v == null || v === "") return null
    const m = String(v).trim().match(/^(\d{1,2}):(\d{2})/)
    if (!m) return null
    const h = Number(m[1])
    const min = Number(m[2])
    if (Number.isNaN(h) || Number.isNaN(min)) return null
    return `${String(h).padStart(2, "0")}:${m[2]}`
}

/** 予約フォームの時刻（type=time の HH:MM や HH:MM:SS）を分に変換 */
export function clientTimeInputToMinutes(timeStr: string | null | undefined): number | null {
    if (!timeStr || typeof timeStr !== "string") return null
    const trimmed = timeStr.trim()
    const m = trimmed.match(/^(\d{1,2}):(\d{2})/)
    if (m) {
        const h = Number(m[1])
        const min = Number(m[2])
        if (!Number.isNaN(h) && !Number.isNaN(min)) return h * 60 + min
    }
    return timeStrToMinutes(trimmed)
}

/** JS と同じ: 0=日 … 6=土 */
export function dayOfWeekFromDateString(dateStr: string): number {
    const d = new Date(`${dateStr}T12:00:00`)
    return d.getDay()
}

/**
 * その日の営業窓 [openMin, closeMin) を分で返す。休業なら null。
 * 例外: is_closed なら休業。休業でないが open/close があるなら上書き。ないなら曜日/全日程にフォールバック。
 */
export function getEffectiveBusinessWindow(
    dateStr: string,
    settings: SchedulingSettings,
    weekly: WeeklyRow[],
    exceptions: ExceptionRow[]
): { openMin: number; closeMin: number } | null {
    const ex = exceptions.find((e) => e.exception_date === dateStr)
    if (ex?.is_closed) return null
    if (ex && !ex.is_closed && ex.open_time && ex.close_time) {
        const o = timeStrToMinutes(ex.open_time)
        const c = timeStrToMinutes(ex.close_time)
        if (o === null || c === null || c <= o) return null
        return { openMin: o, closeMin: c }
    }

    if (settings.business_hours_mode === "uniform") {
        if (!settings.uniform_open || !settings.uniform_close) return null
        const o = timeStrToMinutes(settings.uniform_open)
        const c = timeStrToMinutes(settings.uniform_close)
        if (o === null || c === null || c <= o) return null
        return { openMin: o, closeMin: c }
    }

    const dow = dayOfWeekFromDateString(dateStr)
    const w = weekly.find((x) => x.day_of_week === dow)
    if (!w || w.is_closed) return null
    if (!w.open_time || !w.close_time) return null
    const o = timeStrToMinutes(w.open_time)
    const c = timeStrToMinutes(w.close_time)
    if (o === null || c === null || c <= o) return null
    return { openMin: o, closeMin: c }
}

export type ExistingReservationSlot = {
    startMin: number
    endMin: number
}

/**
 * 既存予約の開始・終了（サービスのみ、分）と移動時間を考慮して新規枠が入るか。
 */
export function canBookSlot(params: {
    dateStr: string
    timeStr: string
    numCars: number
    window: { openMin: number; closeMin: number } | null
    serviceMinutesPerCar: number
    travelMinutes: number
    existing: ExistingReservationSlot[]
}): { ok: true } | { ok: false; reason: string } {
    const { timeStr, numCars, window, serviceMinutesPerCar, travelMinutes, existing } = params
    if (!window) {
        return { ok: false, reason: "この日は休業です。" }
    }
    const startMin = clientTimeInputToMinutes(timeStr)
    if (startMin === null) {
        return { ok: false, reason: "時刻の形式が不正です。" }
    }
    if (numCars < 1) {
        return { ok: false, reason: "台数が不正です。" }
    }
    const duration = numCars * serviceMinutesPerCar
    const endMin = startMin + duration
    if (startMin < window.openMin || endMin > window.closeMin) {
        return {
            ok: false,
            reason:
                endMin > window.closeMin
                    ? "作業終了が閉店時刻を過ぎます。台数・開始時刻を変えるか、所要時間について店舗へお問い合わせください。"
                    : "営業時間外の日時です。",
        }
    }

    // 営業時間内かどうかは「これから取る枠」だけ検証する。既存予約が過去データで閉店後まで伸びていても新規予約を弾かない。
    const slots = [...existing, { startMin, endMin }].sort((a, b) => a.startMin - b.startMin)
    for (let i = 1; i < slots.length; i++) {
        if (slots[i].startMin < slots[i - 1].endMin + travelMinutes) {
            return { ok: false, reason: "この時間は既に予約が入っているか、移動時間の都合で入りません。" }
        }
    }
    return { ok: true }
}
