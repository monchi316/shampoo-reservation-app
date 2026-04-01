/**
 * Canonical snapshot for comparing machine-like objects (registry vs form).
 * Fixes the usual drift: [] vs null vs undefined, empty owner, roleGrants array order.
 *
 * Do not assign the return value back into form state — only use for equality / diff keys.
 */

export function stableMachineSnapshot(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== "object") return null
    const o = raw as Record<string, unknown>

    const sortKey = (arr: unknown): string =>
        Array.isArray(arr) ? [...arr].map(String).sort().join("\u0001") : ""

    const rg = o.roleGrants as Record<string, unknown> | undefined
    const roleGrantsComparable = rg
        ? {
              owner: sortKey(rg.owner),
              member: sortKey(rg.member),
              maintainer: sortKey(rg.maintainer),
          }
        : { owner: "", member: "", maintainer: "" }

    return {
        ...o,
        setup_team: o.setup_team ?? [],
        maintainer: o.maintainer ?? [],
        owner: o.owner && String(o.owner).trim() !== "" ? o.owner : null,
        roleGrants: roleGrantsComparable,
    }
}

export function machineSnapshotsEqual(a: unknown, b: unknown): boolean {
    const sa = stableMachineSnapshot(a)
    const sb = stableMachineSnapshot(b)
    if (!sa || !sb) return sa === sb
    return JSON.stringify(sa) === JSON.stringify(sb)
}

/** Keys that differ in snapshot space; values taken from `current` for PATCH. */
export function machineDeltaFromBaseline(current: unknown, baseline: unknown): Record<string, unknown> {
    const cur = stableMachineSnapshot(current)
    const base = stableMachineSnapshot(baseline)
    if (!cur || !base) return {}

    const delta: Record<string, unknown> = {}
    const curRaw = current as Record<string, unknown>
    const keys = new Set([...Object.keys(cur), ...Object.keys(base)])
    for (const key of keys) {
        if (JSON.stringify(cur[key]) !== JSON.stringify(base[key])) {
            delta[key] = curRaw[key]
        }
    }
    return delta
}
