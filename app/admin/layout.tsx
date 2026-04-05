import type { Metadata } from "next";
import AdminAppShell from "./AdminAppShell";

export const metadata: Metadata = {
  title: "管理画面",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return <AdminAppShell>{children}</AdminAppShell>
}
