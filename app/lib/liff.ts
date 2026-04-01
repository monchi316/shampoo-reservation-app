export const initLiff = async (liffIdInput?: string | null) => {
    // サーバー側で実行された場合は何もしない。
    if (typeof window === "undefined") return null

    // 動的importにして、クライアント実行時だけLIFF SDKを読み込む。
    const liff = (await import("@line/liff")).default

    const liffId = liffIdInput || process.env.NEXT_PUBLIC_LIFF_ID

    // LIFF IDが未設定だと初期化できないため、ここで明示的にエラーにする。
    if (!liffId) {
        throw new Error("LIFF_IDが未設定")
    }

    // LIFF初期化
    await liff.init({ liffId })

    return liff
}

export const getProfile = async () => {
    // すでに初期化済みのLIFFからプロフィールを取得する。
    const liff = (await import("@line/liff")).default

    const profile = await liff.getProfile()

    return {
        userId: profile.userId,
        name: profile.displayName,
    }
}