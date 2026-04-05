import fs from "node:fs/promises"
import path from "node:path"
import MarkdownDoc from "@/app/components/MarkdownDoc"

export default async function TermsPage() {
    const filePath = path.resolve(process.cwd(), "docs", "利用規約.md")
    const markdown = await fs.readFile(filePath, "utf8").catch(() => "")

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            <h1 className="mb-4 text-2xl font-bold">利用規約</h1>
            {markdown ? (
                <MarkdownDoc markdown={markdown} />
            ) : (
                <p className="text-sm text-red-600">利用規約の読み込みに失敗しました。</p>
            )}
        </div>
    )
}

