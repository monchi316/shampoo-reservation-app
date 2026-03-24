import { createClient } from "@supabase/supabase-js"

// 環境変数取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// デバッグ（最初だけ使ってOK）
console.log("Supabase URL:", supabaseUrl)
console.log("Supabase KEY:", supabaseAnonKey ? "OK" : "NG")

// クライアント生成
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log("KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
