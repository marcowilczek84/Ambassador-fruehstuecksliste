import type { Metadata, Viewport } from "next";
import "./ambassador-ui.css";
import "./final-master.css";
import "./ipad-polish.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Ambassador Frühstück",
  description: "Digitale Frühstücksliste des Ambassador Hotel Zürich.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
