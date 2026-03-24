export const initLiff = async () => {
    if (typeof window === "undefined") return null

    const liff = (await import("@line/liff")).default

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID

    console.log("🔥 LIFF_ID:", liffId)

    if (!liffId) {
        throw new Error("LIFF_IDが未設定")
    }

    await liff.init({ liffId })

    return liff
}

export const getProfile = async () => {
    const liff = (await import("@line/liff")).default

    const profile = await liff.getProfile()

    return {
        userId: profile.userId,
        name: profile.displayName,
    }
}