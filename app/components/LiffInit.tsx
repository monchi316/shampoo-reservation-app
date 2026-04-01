"use client"

import { useEffect } from "react"
import liff from "@line/liff"

export default function LiffInit({ liffId }: { liffId: string | null }) {
    useEffect(() => {
        const init = async () => {
            try {
                if (!liffId) {
                    console.error("LIFF ID が未解決のため初期化できません。")
                    return
                }
                // LIFF SDKを初期化。LIFF IDは .env.local から読み込む。
                await liff.init({
                    liffId,
                })

                // ログイン検証用: ?forceLogin=1 で一度ログアウトし、tenantId/lid を残した redirect で再ログイン
                const url = new URL(window.location.href)
                const wantsForceLogin =
                    url.searchParams.get("forceLogin") === "1" ||
                    url.searchParams.get("forceLogin") === "true"
                url.searchParams.delete("forceLogin")
                const redirectUri = url.toString()

                if (wantsForceLogin && liff.isLoggedIn()) {
                    await liff.logout()
                    liff.login({ redirectUri })
                    return
                }

                if (liff.isLoggedIn()) {
                    // LINEログイン済みならプロフィールを取得する。
                    const profile = await liff.getProfile()

                    // 後続処理で使えるようにブラウザへ保存。
                    localStorage.setItem(
                        "user",
                        JSON.stringify({
                            userId: profile.userId,
                            name: profile.displayName,
                            displayName: profile.displayName,
                        })
                    )

                    console.log("✅ LINEログイン情報保存", profile)
                } else {
                    // 未ログインならLINEログイン画面へ遷移（クエリは redirectUri で引き継ぐ）
                    liff.login({ redirectUri })
                }
            } catch (err) {
                console.error("💥 LIFF初期化エラー:", err)
            }
        }

        init()
    }, [liffId])

    return null
}
