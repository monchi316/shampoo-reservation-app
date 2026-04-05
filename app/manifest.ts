import type { MetadataRoute } from "next";

const THEME = "#0f766e";
const BG = "#ffffff";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "洗車予約 管理",
    short_name: "予約管理",
    description: "店舗向けの予約・設定などの管理画面です。",
    lang: "ja",
    start_url: "/admin/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: BG,
    theme_color: THEME,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
