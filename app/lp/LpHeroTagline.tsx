"use client"

type Variant = "fade" | "slide"

/** 最初の「、」の直後で改行（md 以上では 1 行に戻す） */
function TaglineWithMobileBreak({ text }: { text: string }) {
    const i = text.indexOf("、")
    if (i < 0) {
        return <>{text}</>
    }
    return (
        <>
            {text.slice(0, i + 1)}
            <br className="md:hidden" />
            {text.slice(i + 1)}
        </>
    )
}

export function LpHeroTagline({ text, variant = "fade" }: { text: string; variant?: Variant }) {
    const textClass =
        variant === "slide" ? "lp-hero-tagline__text lp-hero-tagline__text--slide" : "lp-hero-tagline__text lp-hero-tagline__text--fade"

    return (
        <h1 className="mt-4 max-w-3xl">
            <span className="inline-block max-w-full">
                <span
                    className={`block text-3xl font-semibold leading-[1.35] tracking-tight text-neutral-900 md:text-4xl md:leading-[1.3] ${textClass}`}
                >
                    <TaglineWithMobileBreak text={text} />
                </span>
                <span
                    className="lp-hero-tagline__line mt-1.5 block h-px w-full max-w-[min(100%,42rem)] bg-neutral-400/55"
                    aria-hidden
                />
            </span>
        </h1>
    )
}
