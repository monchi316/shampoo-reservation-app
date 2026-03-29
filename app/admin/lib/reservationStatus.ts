/** DB の status 値は英語のまま。管理画面では日本語で表示する。 */

export const RESERVATION_STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: "confirmed", label: "予定" },
    { value: "done", label: "実施済み" },
    { value: "cancelled", label: "キャンセル" },
]

export function reservationStatusLabelJa(status: string | null | undefined): string {
    const s = (status || "confirmed").toLowerCase()
    const found = RESERVATION_STATUS_OPTIONS.find((o) => o.value === s)
    if (found) return found.label
    if (status && String(status).trim()) return String(status)
    return "予定"
}

export function reservationStatusBadgeClass(status: string | null | undefined): string {
    const s = (status || "confirmed").toLowerCase()
    if (s === "done") return "bg-emerald-100 text-emerald-900"
    if (s === "cancelled") return "bg-slate-200 text-slate-700"
    return "bg-sky-100 text-sky-900"
}

/** 現在地から目的地までの経路（ナビ）を開く */
export function googleMapsNavigationUrl(destination: string): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}
