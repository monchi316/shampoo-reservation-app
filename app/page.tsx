"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getProfile, initLiff } from "./lib/liff"

export default function Home() {
  const router = useRouter()

  useEffect(() => {

    const init = async () => {
      const liff = await initLiff()
      if (!liff) return

      if (!liff.isLoggedIn()) {
        liff.login()
        return
      }

      const profile = await getProfile()
      localStorage.setItem("user", JSON.stringify(profile))
      router.push("/reserve")
    }

    init()
  }, [])

  return <div>Loading...</div>
}