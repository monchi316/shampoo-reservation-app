/** メニュー slug（size_s / interior_addon 等）から料金を計算 */

export type MenuItemPublic = { slug: string; price: number; active?: boolean; label?: string }

export function menusToPriceMap(items: MenuItemPublic[]): Record<string, number> {
    const m: Record<string, number> = {}
    for (const it of items) {
        if (it.active !== false) m[it.slug] = it.price
    }
    return m
}

export function priceForOneCar(
    size: string | null | undefined,
    interior: boolean,
    prices: Record<string, number>
): number {
    const s = (size || "").toUpperCase()
    const key = `size_${s.toLowerCase()}`
    const base = prices[key] ?? 0
    const addon = interior ? (prices.interior_addon ?? 0) : 0
    return base + addon
}

export function totalForCars(
    cars: { size?: string | null }[],
    interior: boolean,
    prices: Record<string, number>
): number {
    return cars.reduce((sum, c) => sum + priceForOneCar(c.size, interior, prices), 0)
}
