import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { LpHeroTagline } from "./LpHeroTagline"
import { ScrollToDemoCtaButton } from "./ScrollToDemoCtaButton"

/** 洗練したプロダクト呼称（LP主役・本文・メタで共通利用） */
const PRODUCT_LABEL = "モバイル洗車向け 予約・売上プラットフォーム"
const PRODUCT_TAGLINE = "予約から売上確認まで、ひとつの流れで。"
const OFFICIAL_LINE_URL = "https://lin.ee/VrpAi5U"

export const metadata: Metadata = {
    title: `${PRODUCT_LABEL} | SUKIMA Lab.`,
    description:
        "出張洗車（モバイル洗車）事業向け。LINEでの予約受付と管理画面での予約・売上オペレーションをつなぎ、現場の手間をそっと減らします。",
}

const features = [
    {
        title: "LINEからの予約を、取りこぼさない",
        body: "リッチメニューから案内し、営業時間外も受付。お客様は迷わず、店舗は確認先を一本化できます。",
    },
    {
        title: "管理画面で当日の動きを把握",
        body: "日時・台数・住所・車種を一覧で把握。変更やキャンセルも画面上で扱い、電話・メッセージの往復を減らします。",
    },
    {
        title: "通知で連絡漏れを防ぐ",
        body: "予約確定やリマインドを自動送信。現場の記憶頼みを減らし、オペレーションを安定させます。",
    },
    {
        title: "店舗の運用に合わせて調整",
        body: "料金・オプション・文面・稼働枠など、店舗ごとのルールに寄せて設定できます。",
    },
]

const steps = [
    { title: "ヒアリング", body: "現在の予約の取り方と課題を伺い、導線と運用のすり合わせをします。" },
    { title: "初期設定", body: "店舗情報・メニュー・通知の初期設定と、管理画面のご案内を行います。" },
    { title: "LINE連携", body: "公式LINEの導線を整え、予約フォームへ接続します。" },
    { title: "運用開始", body: "公開後も、運用に合わせた微調整をサポートします。" },
]

const faqs = [
    {
        q: "ITに不慣れでも使えますか？",
        a: "日々の操作は予約の確認と更新が中心です。導入時に画面操作と運用の流れを一緒に整えます。",
    },
    {
        q: "既存のLINE公式アカウントは使えますか？",
        a: "利用できます。友だちを活かしたまま、予約導線を追加できます。",
    },
    {
        q: "規模が小さくても導入できますか？",
        a: "はい。まずは必要な範囲から始め、運用に合わせて広げていく形がおすすめです。",
    },
]

export default function LandingPage() {
    return (
        <main className="min-h-screen">
            <header className="border-b border-neutral-200/80 bg-white/90 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-6 md:gap-6 md:py-7">
                    <Image
                        src="/lp/logo.png"
                        alt="SUKIMA Lab."
                        width={72}
                        height={72}
                        className="shrink-0 rounded-2xl border border-neutral-200 shadow-sm"
                    />
                    <div className="min-w-0 leading-tight">
                        <p className="text-xs font-medium tracking-wide text-neutral-500 md:text-sm">SUKIMA Lab.</p>
                        <p className="mt-1 text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl md:text-2xl">
                            {PRODUCT_LABEL}
                        </p>
                    </div>
                </div>
            </header>

            <section className="border-b border-neutral-200 bg-white">
                <div className="mx-auto max-w-6xl px-6 pb-20 pt-14 md:pb-24 md:pt-20">
                    <p className="text-xs font-semibold tracking-[0.12em] text-neutral-500">{PRODUCT_LABEL}</p>
                    <LpHeroTagline text={PRODUCT_TAGLINE} variant="fade" />
                    <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-neutral-600 md:text-base">
                        電話やDMに散らばりがちな予約を、LINEと管理画面に集約。
                        出張洗車（モバイル洗車）の現場で、確認と連絡の手間をひとつずつ減らすための仕組みです。
                    </p>
                    <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Link
                            href="/reserve"
                            className="inline-flex justify-center rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
                        >
                            予約フォームを試す
                        </Link>
                        <ScrollToDemoCtaButton
                            targetId="lp-demo-cta"
                            className="inline-flex justify-center rounded-lg border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
                        >
                            管理画面を見る
                        </ScrollToDemoCtaButton>
                    </div>
                    <div className="mt-14 grid gap-4 sm:grid-cols-3">
                        {[
                            { t: "予約の受け口を一本化", d: "LINEから迷わず入力" },
                            { t: "当日の把握がしやすい", d: "一覧で状況を共有" },
                            { t: "連絡の抜けを抑える", d: "通知でリマインド" },
                        ].map((item) => (
                            <div
                                key={item.t}
                                className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-5 py-4"
                            >
                                <p className="font-semibold text-neutral-900">{item.t}</p>
                                <p className="mt-1 text-sm text-neutral-600">{item.d}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
                <h2 className="text-xl font-semibold text-neutral-900 md:text-2xl">主な機能</h2>
                <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                    現場で本当に使うところに絞り、操作と運用の負担を小さくします。
                </p>
                <div className="mt-10 grid gap-5 md:grid-cols-2">
                    {features.map((f) => (
                        <article key={f.title} className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                            <h3 className="text-base font-semibold text-neutral-900">{f.title}</h3>
                            <p className="mt-3 text-sm leading-relaxed text-neutral-600">{f.body}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="border-y border-neutral-200 bg-neutral-100/60">
                <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
                    <div className="mx-auto max-w-2xl text-center">
                        <p className="text-xs font-semibold tracking-[0.14em] text-neutral-500">ABOUT</p>
                        <p className="mt-5 text-sm leading-relaxed text-neutral-600">
                            日常や業務の「ちょっと不便」「少し面倒」に目を向け、必要なところだけ、そっと手を添える。
                        </p>
                        <p className="mt-4 text-sm font-semibold text-neutral-800">このプロダクトも</p>
                        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                            メニューや料金を変えるたび、返信対応や予約ツールの変更に追われる。必要な情報を一度でそろえきれない。売上は領収書まわりで別ルート。予約管理は手帳や記憶、ときどきLINEやDMを遡る——。
                            モバイル洗車の現場で、そんな声を聞いたところから始まりました。
                        </p>
                        <p className="mt-4 text-sm font-bold tracking-wide text-neutral-900">小さな不便を、静かにほどく。</p>
                        <Link
                            href="/lab"
                            className="mt-6 inline-flex items-center justify-center rounded-lg border border-neutral-400 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-500 hover:bg-neutral-50"
                        >
                            SUKIMA Lab. のコンセプトを見る
                        </Link>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
                <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:items-start">
                    <div>
                        <h2 className="text-xl font-semibold text-neutral-900 md:text-2xl">ご利用イメージ</h2>
                        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                            まずは運用に必要な範囲から。店舗の規模やルールに合わせて、段階的に広げられます。
                        </p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                        <p className="text-sm font-semibold text-neutral-900">お問い合わせください</p>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                            お問い合わせは公式LINEで承っています。導入相談やデモのご案内もこちらで対応します。
                        </p>
                        <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                            <li>・予約フォーム（LINE連携）</li>
                            <li>・管理画面</li>
                            <li>・通知・リマインド</li>
                            <li>・導入・運用サポート</li>
                        </ul>
                        <ScrollToDemoCtaButton
                            targetId="lp-demo-cta"
                            className="mt-6 inline-flex w-full justify-center rounded-lg border border-neutral-300 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
                        >
                            デモで操作感を確認する
                        </ScrollToDemoCtaButton>
                        <a
                            href={OFFICIAL_LINE_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                        >
                            公式LINEで問い合わせる
                        </a>
                    </div>
                </div>
            </section>

            <section className="border-t border-neutral-200 bg-white">
                <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
                    <h2 className="text-xl font-semibold text-neutral-900 md:text-2xl">導入の流れ</h2>
                    <div className="mt-10 grid gap-4 md:grid-cols-2">
                        {steps.map((s, idx) => (
                            <div key={s.title} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
                                <p className="text-xs font-semibold text-neutral-500">STEP {String(idx + 1).padStart(2, "0")}</p>
                                <h3 className="mt-1 font-semibold text-neutral-900">{s.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-t border-neutral-200 bg-neutral-50/80">
                <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
                    <h2 className="text-xl font-semibold text-neutral-900 md:text-2xl">よくある質問</h2>
                    <div className="mt-8 space-y-2">
                        {faqs.map((f) => (
                            <details
                                key={f.q}
                                className="group rounded-xl border border-neutral-200 bg-white p-4 shadow-sm open:shadow-md"
                            >
                                <summary className="cursor-pointer list-none font-semibold text-neutral-900 marker:hidden [&::-webkit-details-marker]:hidden">
                                    {f.q}
                                </summary>
                                <p className="mt-3 text-sm leading-relaxed text-neutral-600">{f.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            <section id="lp-demo-cta" className="scroll-mt-24 border-t border-neutral-200 bg-white">
                <div className="mx-auto max-w-6xl px-6 py-16 md:pb-20">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-8 py-12 text-center md:px-12">
                        <h2 className="text-xl font-semibold text-neutral-900 md:text-2xl">まずはデモで、操作感を確かめてください</h2>
                        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-600">
                            予約フォームと管理画面を触るだけで、導入後のイメージがつかみやすくなります。
                        </p>
                        <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-neutral-300 bg-white px-4 py-4 text-left">
                            <p className="text-sm font-semibold text-neutral-900">管理画面デモをご利用の方へ</p>
                            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                                管理画面の操作にはメールアドレスとパスワードの入力が必要です。
                                デモ用のメールアドレスとパスワードは、公式LINEにて配布しています。
                            </p>
                        </div>
                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <Link
                                href="/reserve"
                                className="inline-flex justify-center rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
                            >
                                予約デモへ
                            </Link>
                            <Link
                                href="/admin/login"
                                className="inline-flex justify-center rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
                            >
                                管理デモへ
                            </Link>
                        </div>
                        <div className="mt-6 flex flex-col items-center justify-center gap-4">
                            <a
                                href={OFFICIAL_LINE_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex w-full max-w-sm items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                            >
                                公式LINEを友だち追加
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="border-t border-neutral-200 bg-neutral-50 py-10">
                <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-center sm:flex-row sm:justify-between sm:text-left">
                    <div className="flex items-center gap-3">
                        <Image src="/lp/logo.png" alt="SUKIMA Lab." width={32} height={32} className="rounded-md opacity-90" />
                        <div>
                            <p className="text-sm font-semibold text-neutral-800">SUKIMA Lab.</p>
                            <p className="text-xs text-neutral-500">{PRODUCT_LABEL}</p>
                        </div>
                    </div>
                    <p className="max-w-md text-xs leading-relaxed text-neutral-500">
                        本ページは製品紹介用です。契約条件・料金はお問い合わせ時にご案内します。
                    </p>
                </div>
            </footer>
        </main>
    )
}
