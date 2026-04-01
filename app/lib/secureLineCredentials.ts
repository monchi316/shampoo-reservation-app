import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const ENC_VERSION = "v1"
const ALGO = "aes-256-gcm"

function getEncryptionKey(): Buffer {
    const raw = process.env.LINE_CREDENTIALS_ENCRYPTION_KEY
    if (typeof raw !== "string" || raw.length < 32) {
        throw new Error("LINE_CREDENTIALS_ENCRYPTION_KEY が未設定か短すぎます（32文字以上）")
    }
    // 任意長の秘密文字列を固定長(32byte)鍵へ正規化
    return createHash("sha256").update(raw, "utf8").digest()
}

export function isLineCredentialEncryptionConfigured(): boolean {
    const raw = process.env.LINE_CREDENTIALS_ENCRYPTION_KEY
    return typeof raw === "string" && raw.length >= 32
}

/**
 * 平文を暗号化し、DB保存用の文字列として返す。
 * 形式: v1.<iv_b64url>.<tag_b64url>.<cipher_b64url>
 */
export function encryptLineCredential(plainText: string): string {
    if (typeof plainText !== "string" || plainText.length === 0) {
        throw new Error("暗号化対象の文字列が空です")
    }
    const key = getEncryptionKey()
    const iv = randomBytes(12) // GCM 推奨長
    const cipher = createCipheriv(ALGO, key, iv)
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${ENC_VERSION}.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`
}

/**
 * DB保存済みの暗号文字列を復号して平文を返す。
 */
export function decryptLineCredential(payload: string): string {
    if (typeof payload !== "string" || payload.length === 0) {
        throw new Error("復号対象の文字列が空です")
    }
    const parts = payload.split(".")
    if (parts.length !== 4 || parts[0] !== ENC_VERSION) {
        throw new Error("暗号化ペイロード形式が不正です")
    }
    const iv = Buffer.from(parts[1], "base64url")
    const tag = Buffer.from(parts[2], "base64url")
    const encrypted = Buffer.from(parts[3], "base64url")
    const key = getEncryptionKey()
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
    if (!plain) {
        throw new Error("復号結果が空です")
    }
    return plain
}

