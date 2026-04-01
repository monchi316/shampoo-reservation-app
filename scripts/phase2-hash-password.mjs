#!/usr/bin/env node
/**
 * Phase 2: admin_operators.password_hash 用（scrypt）
 * 使い方: node scripts/phase2-hash-password.mjs 'your-password'
 */
import { randomBytes, scryptSync } from "node:crypto"

const plain = process.argv[2]
if (!plain || plain.length < 8) {
    console.error("使い方: node scripts/phase2-hash-password.mjs '<8文字以上のパスワード>'")
    process.exit(1)
}

const salt = randomBytes(16)
const key = scryptSync(plain, salt, 64)
const stored = `scrypt$${salt.toString("base64")}$${key.toString("base64")}`
console.log(stored)
