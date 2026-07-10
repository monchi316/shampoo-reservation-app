import { lineMessagingPush } from "@/app/lib/linePush"
import type { LineFlexReservationMessage } from "@/app/lib/lineMessageTemplates"

export {
    lineAdminNotifyUserIdsToText,
    parseLineAdminNotifyUserIds,
    validateLineAdminNotifyUserIds,
} from "@/app/lib/lineAdminNotifyIds"

type LinePushKind = "reservation_created" | "reservation_updated" | "cancelled" | "reminder" | "test"

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
