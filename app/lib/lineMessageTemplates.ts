export type LinePushTemplateVars = {
    customer_name: string
    tenant_name: string
    reservation_date: string
    reservation_time: string
    cars_summary: string
    address: string
    edit_url: string
    cancel_url: string
}

const KEYS = [
    "customer_name",
    "tenant_name",
    "reservation_date",
    "reservation_time",
    "cars_summary",
    "address",
    "edit_url",
    "cancel_url",
] as const

export function applyLinePushTemplate(template: string, vars: LinePushTemplateVars): string {
    let out = template
    for (const k of KEYS) {
        const v = vars[k] ?? ""
        out = out.replaceAll(`{{${k}}}`, v)
    }
    return out
}

export function buildDefaultReminderMessage(vars: LinePushTemplateVars): string {
    const p = vars
    return `【前日リマインド】明日のご予約です🚗

👤 お名前：${p.customer_name}
🏪 店舗：${p.tenant_name}
📅 日時：${p.reservation_date} ${p.reservation_time}
🚙 車種：
${p.cars_summary}
📍 住所：${p.address}

変更はこちら👇
${p.edit_url}

キャンセルはこちら👇
${p.cancel_url}`
}

export function buildDefaultReservationCompleteMessage(vars: LinePushTemplateVars): string {
    const p = vars
    return `予約完了🚗✨

👤 お名前：${p.customer_name}
📅 日時：${p.reservation_date} ${p.reservation_time}
🚙 車種：
${p.cars_summary}
📍 住所：${p.address}

変更はこちら👇
${p.edit_url}

キャンセルはこちら👇
${p.cancel_url}`
}

export function buildDefaultReservationChangeMessage(vars: LinePushTemplateVars): string {
    const p = vars
    return `予約内容を変更しました🛠️

👤 お名前：${p.customer_name}
📅 日時：${p.reservation_date} ${p.reservation_time}
🚙 車種：
${p.cars_summary}
📍 住所：${p.address}

変更はこちら👇
${p.edit_url}

キャンセルはこちら👇
${p.cancel_url}`
}

export function buildDefaultReservationCancelMessage(vars: LinePushTemplateVars): string {
    const p = vars
    return `予約のキャンセルが完了しました。

👤 お名前：${p.customer_name}
📅 日時：${p.reservation_date} ${p.reservation_time}
🚙 車種：
${p.cars_summary}
📍 住所：${p.address}

またのご利用をお待ちしております。`
}

export function resolveReminderMessage(
    customTemplate: string | null | undefined,
    vars: LinePushTemplateVars
): string {
    const t = (customTemplate || "").trim()
    return t.length > 0 ? applyLinePushTemplate(t, vars) : buildDefaultReminderMessage(vars)
}

export function resolveReservationCompleteMessage(
    customTemplate: string | null | undefined,
    vars: LinePushTemplateVars
): string {
    const t = (customTemplate || "").trim()
    return t.length > 0 ? applyLinePushTemplate(t, vars) : buildDefaultReservationCompleteMessage(vars)
}

export function resolveReservationChangeMessage(
    customTemplate: string | null | undefined,
    vars: LinePushTemplateVars
): string {
    const t = (customTemplate || "").trim()
    return t.length > 0 ? applyLinePushTemplate(t, vars) : buildDefaultReservationChangeMessage(vars)
}

export function resolveReservationCancelMessage(
    customTemplate: string | null | undefined,
    vars: LinePushTemplateVars
): string {
    const t = (customTemplate || "").trim()
    return t.length > 0 ? applyLinePushTemplate(t, vars) : buildDefaultReservationCancelMessage(vars)
}

/** 本文中の変更・キャンセル用 URL を除き、Flex の body に載せる（LINE テキスト内URLの二重リンクプレビュー回避） */
export function stripActionUrlsFromLineBody(fullText: string, editUrl: string, cancelUrl: string): string {
    const urls = [editUrl, cancelUrl].filter((u): u is string => typeof u === "string" && u.length > 0)
    urls.sort((a, b) => b.length - a.length)
    let s = fullText
    for (const u of urls) {
        s = s.split(u).join("")
    }
    return s.replace(/\n{3,}/g, "\n\n").trim() || "下のボタンから変更・キャンセルできます。"
}

export function reservationFlexAltText(bodyText: string): string {
    const line = bodyText.split("\n").find((l) => l.trim().length > 0) || "洗車予約のお知らせ"
    return line.trim().slice(0, 400)
}

export type LineFlexReservationMessage = {
    type: "flex"
    altText: string
    contents: {
        type: "bubble"
        body: {
            type: "box"
            layout: "vertical"
            contents: Array<{ type: "text"; text: string; wrap: true; size: "sm" }>
        }
        footer: {
            type: "box"
            layout: "vertical"
            spacing: "sm"
            contents: Array<{
                type: "button"
                style: "primary" | "secondary"
                height: "sm"
                action: { type: "uri"; label: string; uri: string }
            }>
        }
    }
}

/** 変更・キャンセルは URI アクション（本文に https を出さない） */
export function buildReservationFlexMessage(params: {
    bodyText: string
    editUrl: string
    cancelUrl: string
}): LineFlexReservationMessage {
    return {
        type: "flex",
        altText: reservationFlexAltText(params.bodyText),
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                contents: [{ type: "text", text: params.bodyText, wrap: true, size: "sm" }],
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: { type: "uri", label: "予約を変更", uri: params.editUrl },
                    },
                    {
                        type: "button",
                        style: "secondary",
                        height: "sm",
                        action: { type: "uri", label: "予約をキャンセル", uri: params.cancelUrl },
                    },
                ],
            },
        },
    }
}
