/** 管理画面用: ナンバー文字列の末尾4文字（空白・ハイフン除去後） */
export function adminPlateLast4(plate: string | null | undefined): string {
    const raw = (plate || "").replace(/\s/g, "").replace(/-/g, "").replace(/ー/g, "")
    if (!raw) return "—"
    if (raw.length <= 4) return raw
    return raw.slice(-4)
}

/** 一覧・詳細用の1行表記。データが無ければ null */
export function adminVehicleColorPlateLine(
    colorAbbr: string | null | undefined,
    plate: string | null | undefined
): string | null {
    const color = (colorAbbr || "").trim()
    const tail = adminPlateLast4(plate)
    if (!color && tail === "—") return null
    return `色 ${color || "—"} ／ ナンバー下4桁 ${tail}`
}
