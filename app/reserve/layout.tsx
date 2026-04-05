import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "予約",
};

export default function ReserveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
