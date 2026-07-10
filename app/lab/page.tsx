import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
    title: "コンセプト | SUKIMA Lab.",
    description:
        "日常や業務の小さな引っかかりに目を向け、必要なところにだけそっと手を添える。SUKIMA Lab. の考え方をご紹介します。",
}

export default function LabConceptPage() {
    return (
        <main className="min-h-screen">
            <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur-sm">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
                    <Link href="/lp" className="flex items-center gap-3 transition hover:opacity-80">
                        <Image
                            src="/lp/logo.png"
                            alt="SUKIMA Lab."
                            width={36}
                            height={36}
                            className="rounded-lg border border-neutral-200"
                        />
                        <div className="leading-tight">
                            <p className="text-[11px] font-medium tracking-wide text-neutral-500">SUKIMA Lab.</p>
                            <p className="text-sm font-semibold text-neutral-800">コンセプト</p>
                        </div>
                    </Link>
                    <Link
                        href="/lp"
                        className="text-sm font-medium text-neutral-600 transition hover:text-neutral-900"
                    >
                        プロダクトLPへ
                    </Link>
                </div>
            </header>

            <article className="mx-auto max-w-3xl px-6 py-14 md:py-20">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
                    小さな違和感を、静かに解決する。
                </h1>
                <p className="mt-6 text-sm leading-relaxed text-neutral-600 md:text-[15px]">
                    SUKIMA Lab. は、日常や業務のなかにある「ちょっと不便」「少し面倒」「なんとなく気になる」——そんな
                    <span className="whitespace-nowrap">小さな引っかかり＝スキマ</span>
                    に目を向ける研究所です。
                </p>

                <section className="mt-12 space-y-4 text-sm leading-relaxed text-neutral-600 md:text-[15px]">
                    <p>
                        大きな変革や派手な仕組みではなく、必要なところにだけ、そっと手を添える。
                        使った人が説明しなくても「なんかいいね」と感じるくらいの自然さで、気づかないうちに体験が整っている状態を目指します。
                    </p>
                    <p className="font-semibold text-neutral-800">ちょうどいい改善を、積み重ねる。</p>
                    <p>
                        世の中を一気に変えるのではなく、一人の作業が少しラクになること。一つの手間が一つ減ること。一つの迷いがなくなること。
                        その小さな積み重ねが、使う人の表情を少しゆるめる——そんな「ちょうどいい改善」を、丁寧に形にしていきます。
                    </p>
                </section>

                <section className="mt-12 space-y-4 text-sm leading-relaxed text-neutral-600 md:text-[15px]">
                    <p className="font-semibold text-neutral-800">静かに役に立つものを。</p>
                    <p>
                        主張しすぎず、でも確実に役に立つ。余白のように自然に存在し、使う人の流れを邪魔しない。気づけば手放せなくなっている——そんなプロダクトを目指しています。
                    </p>
                </section>

                <p className="mt-14 border-t border-neutral-200 pt-10 text-center text-base font-bold tracking-wide text-neutral-900">
                    小さな不便を、静かにほどく。
                </p>

                <p className="mt-10 rounded-xl border border-dashed border-neutral-300 bg-white/80 px-4 py-3 text-center text-xs leading-relaxed text-neutral-500">
                    今後、このページにプロダクト一覧や導入事例などを追加していく予定です。
                </p>
            </article>

            <footer className="border-t border-neutral-200 bg-white py-8">
                <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-6 text-center sm:flex-row sm:justify-between sm:text-left">
                    <p className="text-xs text-neutral-500">© SUKIMA Lab.</p>
                    <Link href="/lp" className="text-xs font-medium text-neutral-600 underline-offset-2 hover:underline">
                        モバイル洗車向けプラットフォームの紹介へ
                    </Link>
                </div>
            </footer>
        </main>
    )
}
