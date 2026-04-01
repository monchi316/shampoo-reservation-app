import React from "react"

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
    // /admin/login 自体はガード対象外（ここでリダイレクトしない）
    return <>{children}</>
}

