"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getProfile, initLiff } from "./lib/liff"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // 入口ページでLIFFを初期化し、ログイン状態を確認する。
    const init = async () => {
      const liff = await initLiff()
      if (!liff) return

      if (!liff.isLoggedIn()) {
        // 未ログインならLINEログインへ遷移。
        liff.login()
        return
      }

      // ログイン済みならプロフィールを保存し、予約ページへ進む。
      const profile = await getProfile()
      localStorage.setItem("user", JSON.stringify(profile))
      router.push("/reserve")
    }

    init()
  }, [])

  return <div>Loading...</div>
}