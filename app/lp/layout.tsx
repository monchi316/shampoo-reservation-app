import type { ReactNode } from "react"
import { Noto_Sans_JP } from "next/font/google"

const notoSansJp = Noto_Sans_JP({
    weight: ["400", "500", "600", "700"],
    subsets: ["latin"],
    display: "swap",
})

export default function LpLayout({ children }: { children: ReactNode }) {
    return <div className={`${notoSansJp.className} min-h-screen bg-neutral-50 text-neutral-800 antialiased`}>{children}</div>
}
