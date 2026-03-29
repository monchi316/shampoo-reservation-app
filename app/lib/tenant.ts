/** ログイン前は単一テナント。将来はセッションの tenant_id に差し替え。 */
export const DEFAULT_TENANT_ID =
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "00000000-0000-4000-8000-000000000001"
