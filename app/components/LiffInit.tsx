"use client"

import { useEffect } from "react"
import liff from "@line/liff"

export default function LiffInit() {
    useEffect(() => {
        const init = async () => {
            try {
                await liff.init({
                    liffId: process.env.NEXT_PUBLIC_LIFF_ID!,
                })

                if (liff.isLoggedIn()) {
                    const profile = await liff.getProfile()

                    localStorage.setItem(
                        "user",
                        JSON.stringify({
                            userId: profile.userId,
                            displayName: profile.displayName,
                        })
                    )

                    console.log("✅ LINEログイン情報保存", profile)
                } else {
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
