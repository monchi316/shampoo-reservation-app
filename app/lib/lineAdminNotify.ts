import { lineMessagingPush } from "@/app/lib/linePush"
import type { LineFlexReservationMessage } from "@/app/lib/lineMessageTemplates"

type LinePushKind = "reservation_created" | "reservation_updated" | "cancelled" | "reminder" | "test"

const LINE_USER_ID_RE = /^U[a-f0-9]{32}$/i

/** DB の text[] や API 入力から通知先 ID 一覧を正規化する */
export function parseLineAdminNotifyUserIds(raw: unknown): string[] {
    const items: string[] = []
    if (Array.isArray(raw)) {
        for (const entry of raw) {
            const s = String(entry ?? "").trim()
            if (s) items.push(s)
        }
    } else if (typeof raw === "string") {
        for (const line of raw.split(/[\n,]+/)) {
            const s = line.trim()
            if (s) items.push(s)
        }
    }
    const seen = new Set<string>()
    const out: string[] = []
    for (const id of items) {
        const key = id.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(id)
    }
    return out
}

export function validateLineAdminNotifyUserIds(ids: string[]): string | null {
    if (ids.length > 20) return "管理者通知先は最大20件までです"
    for (const id of ids) {
        if (id.length > 64) return "LINE user ID が長すぎます"
        if (!LINE_USER_ID_RE.test(id)) {
            return `LINE user ID の形式が不正です: ${id.slice(0, 8)}…`
        }
    }
    return null
}

/** テキスト行（改行区切り）↔ 配列の相互変換（設定 UI 用） */
export function lineAdminNotifyUserIdsToText(ids: string[]): string {
    return ids.join("\n")
}

type PushToAdminsParams = {
    tenantId: string
    adminUserIds: string[]
    excludeUserId?: string
    kind: LinePushKind
    reservationGroupId?: string | null
    text?: string
    flexMessage?: LineFlexReservationMessage
}

/** 登録済み管理者へ、お客様と同じ文面を追加送信する */
export async function pushLineToTenantAdmins(params: PushToAdminsParams): Promise<void> {
    const { tenantId, adminUserIds, excludeUserId, kind, reservationGroupId, text, flexMessage } = params
    if (!adminUserIds.length) return

    for (const adminId of adminUserIds) {
        if (excludeUserId && adminId === excludeUserId) continue
        await lineMessagingPush({
            tenantId,
            toUserId: adminId,
            text,
            flexMessage,
            kind,
            reservationGroupId: reservationGroupId ?? null,
        })
    }
}
