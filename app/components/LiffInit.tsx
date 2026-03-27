"use client"

import { useEffect } from "react"
import liff from "@line/liff"

export default function LiffInit() {
    useEffect(() => {
        const init = async () => {
            try {
                // LIFF SDKを初期化。LIFF IDは .env.local から読み込む。
                await liff.init({
                    liffId: process.env.NEXT_PUBLIC_LIFF_ID!,
                })

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
                    // 未ログインならLINEログイン画面へ遷移。
                    liff.login()
                }
            } catch (err) {
                console.error("💥 LIFF初期化エラー:", err)
            }
        }

        init()
    }, [])

    return null
}
