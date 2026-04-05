"use client"

import { useEffect, useRef } from "react"
import liff from "@line/liff"

export type LiffInitStatus =
    | { state: "idle" }
    | { state: "skipped"; reason: "no_liff_id" }
    | { state: "awaiting_login" }
    | { state: "profile_ready" }
    | { state: "error"; message: string }

type DecodedIdToken = {
    sub?: string
    name?: string
}

async function resolveLineUserForStorage(): Promise<{
    userId: string
    displayName: string
}> {
    try {
        const profile = await liff.getProfile()
        return { userId: profile.userId, displayName: profile.displayName }
    } catch (first) {
        const msg = first instanceof Error ? first.message : String(first)
        const scopeRelated = /scope|permission|not in liff/i.test(msg)
        if (
            scopeRelated &&
            liff.isLoggedIn() &&
            typeof liff.getDecodedIDToken === "function"
        ) {
            try {
                const tok = (await liff.getDecodedIDToken()) as DecodedIdToken | null
                const sub = tok && typeof tok.sub === "string" ? tok.sub.trim() : ""
                if (sub.length > 0) {
                    const displayName =
                        tok && typeof tok.name === "string" && tok.name.trim().length > 0
                            ? tok.name.trim()
                            : "お客様"
                    console.log("✅ ID トークンからユーザー情報を保存（profile スコープなし）")
                    return { userId: sub, displayName }
                }
            } catch (idErr) {
                console.warn("getDecodedIDToken フォールバック失敗:", idErr)
            }
        }
        throw first
    }
}

function stripLiffUnfriendlyQueryParams(): void {
    if (typeof window === "undefined") return
    const u = new URL(window.location.href)
    let changed = false
    // LINE は登録エンドポイントと「現在の URL」一致を検証する。debug 等でクエリが増えると liff.init が失敗することがある。
    if (u.searchParams.has("debug")) {
        u.searchParams.delete("debug")
        changed = true
    }
    if (changed) {
        window.history.replaceState({}, "", u.toString())
    }
}

export default function LiffInit({
    liffId,
    /** URL の lid と DB の liff_id が異なるとき、2 番目に試す ID */
    fallbackLiffId,
    onStatus,
}: {
    liffId: string | null
    fallbackLiffId?: string | null
    onStatus?: (s: LiffInitStatus) => void
}) {
    const onStatusRef = useRef(onStatus)
    onStatusRef.current = onStatus

    useEffect(() => {
        onStatusRef.current?.({ state: "idle" })

        const init = async () => {
            try {
                if (!liffId) {
                    console.error("LIFF ID が未解決のため初期化できません。")
                    onStatusRef.current?.({ state: "skipped", reason: "no_liff_id" })
                    return
                }

                stripLiffUnfriendlyQueryParams()

                const doInit = async (id: string) => {
                    await liff.init({
                        liffId: id,
                        withLoginOnExternalBrowser: true,
                    })
                }

                try {
                    await doInit(liffId)
                } catch (firstErr) {
                    const fb =
                        typeof fallbackLiffId === "string" &&
                        fallbackLiffId.trim().length > 0 &&
                        fallbackLiffId.trim() !== liffId
                            ? fallbackLiffId.trim()
                            : null
                    if (fb) {
                        console.warn("LIFF init を fallback liffId で再試行します", fb)
                        await doInit(fb)
                    } else {
                        throw firstErr
                    }
                }

                const url = new URL(window.location.href)
                const wantsForceLogin =
                    url.searchParams.get("forceLogin") === "1" ||
                    url.searchParams.get("forceLogin") === "true"
                url.searchParams.delete("forceLogin")
                url.searchParams.delete("debug")
                const redirectUri = url.toString()

                if (wantsForceLogin && liff.isLoggedIn()) {
                    await liff.logout()
                    liff.login({ redirectUri })
                    onStatusRef.current?.({ state: "awaiting_login" })
                    return
                }

                if (liff.isLoggedIn()) {
                    try {
                        const { userId, displayName } = await resolveLineUserForStorage()
                        localStorage.setItem(
                            "user",
                            JSON.stringify({
                                userId,
                                name: displayName,
                                displayName,
                            })
                        )
                        onStatusRef.current?.({ state: "profile_ready" })
                    } catch (pe) {
                        const pm = pe instanceof Error ? pe.message : String(pe)
                        console.error("LINE ユーザー情報取得エラー:", pe)
                        onStatusRef.current?.({
                            state: "error",
                            message: `ログイン後のプロフィール取得に失敗しました: ${pm}`,
                        })
                    }
                } else {
                    liff.login({ redirectUri })
                    onStatusRef.current?.({ state: "awaiting_login" })
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                console.error("💥 LIFF初期化エラー:", err)
                onStatusRef.current?.({ state: "error", message })
            }
        }

        void init()
    }, [liffId, fallbackLiffId])

    return null
}
