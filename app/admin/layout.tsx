import type { Metadata } from "next";
import AdminAppShell from "./AdminAppShell";

export const metadata: Metadata = {
  title: "管理画面",
  description: "店舗向けの予約・設定などの管理画面です。",
  openGraph: {
    title: "管理画面",
    description: "店舗向けの予約・設定などの管理画面です。",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return <AdminAppShell>{children}</AdminAppShell>
}
