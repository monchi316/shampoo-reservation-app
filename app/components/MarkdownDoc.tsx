type MarkdownDocProps = {
    markdown: string
}

type Block =
    | { type: "h1" | "h2" | "h3"; text: string }
    | { type: "p"; text: string }
    | { type: "ul"; items: string[] }
    | { type: "ol"; items: string[] }

function parseMarkdown(markdown: string): Block[] {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n")
    const blocks: Block[] = []
    let i = 0

    const pushParagraph = (start: number) => {
        const acc: string[] = []
        let idx = start
        while (idx < lines.length) {
            const l = lines[idx].trim()
            if (!l) break
            if (/^#{1,3}\s+/.test(l)) break
            if (/^[-*]\s+/.test(l)) break
            if (/^\d+\.\s+/.test(l)) break
            acc.push(l)
            idx += 1
        }
        if (acc.length > 0) {
            blocks.push({ type: "p", text: acc.join(" ") })
        }
        return idx
    }

    while (i < lines.length) {
        const raw = lines[i]
        const line = raw.trim()
        if (!line) {
            i += 1
            continue
        }

        const h = line.match(/^(#{1,3})\s+(.+)$/)
        if (h) {
            const level = h[1].length
            blocks.push({
                type: level === 1 ? "h1" : level === 2 ? "h2" : "h3",
                text: h[2].trim(),
            })
            i += 1
            continue
        }

        if (/^[-*]\s+/.test(line)) {
            const items: string[] = []
            while (i < lines.length) {
                const li = lines[i].trim()
                const m = li.match(/^[-*]\s+(.+)$/)
                if (!m) break
                items.push(m[1].trim())
                i += 1
            }
            blocks.push({ type: "ul", items })
            continue
        }

        if (/^\d+\.\s+/.test(line)) {
            const items: string[] = []
            while (i < lines.length) {
                const li = lines[i].trim()
                const m = li.match(/^\d+\.\s+(.+)$/)
                if (!m) break
                items.push(m[1].trim())
                i += 1
            }
            blocks.push({ type: "ol", items })
            continue
        }

        i = pushParagraph(i)
    }

    return blocks
}

export default function MarkdownDoc({ markdown }: MarkdownDocProps) {
    const blocks = parseMarkdown(markdown)

    return (
        <article className="rounded-lg border border-slate-200 bg-white px-6 py-5 text-slate-800">
            {blocks.map((b, idx) => {
                if (b.type === "h1") {
                    return (
                        <h1 key={idx} className="mt-6 first:mt-0 text-3xl font-bold tracking-tight text-slate-900">
                            {b.text}
                        </h1>
                    )
                }
                if (b.type === "h2") {
                    return (
                        <h2 key={idx} className="mt-8 text-xl font-semibold text-slate-900">
                            {b.text}
                        </h2>
                    )
                }
                if (b.type === "h3") {
                    return (
                        <h3 key={idx} className="mt-6 text-lg font-semibold text-slate-900">
                            {b.text}
                        </h3>
                    )
                }
                if (b.type === "ul") {
                    return (
                        <ul key={idx} className="mt-3 list-disc space-y-1 pl-6 text-[15px] leading-7">
                            {b.items.map((it, i) => (
                                <li key={i}>{it}</li>
                            ))}
                        </ul>
                    )
                }
                if (b.type === "ol") {
                    return (
                        <ol key={idx} className="mt-3 list-decimal space-y-1 pl-6 text-[15px] leading-7">
                            {b.items.map((it, i) => (
                                <li key={i}>{it}</li>
                            ))}
                        </ol>
                    )
                }
                return (
                    <p key={idx} className="mt-3 text-[15px] leading-7 text-slate-800">
                        {b.text}
                    </p>
                )
            })}
        </article>
    )
}

