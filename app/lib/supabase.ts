import { createClient } from "@supabase/supabase-js"

// Supabase接続先（公開してよいクライアント用キー）を環境変数から読む。
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 画面側から利用するSupabaseクライアントを作成。
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
