import type { Metadata, Viewport } from "next";
import { ThemeScript } from "@/components/theme/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pactset.vercel.app"),
  title: { default: "Pactset · One shared plan", template: "%s · Pactset" },
  description: "A staged event operations platform for organizers, suppliers, crew, and assigned support, built around Stellar Testnet.",
  applicationName: "Pactset",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Pactset", description: "Bring your venue, suppliers and crew into one shared plan.", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f5ef" }, { media: "(prefers-color-scheme: dark)", color: "#061f1e" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth"><head><ThemeScript /></head><body>{children}</body></html>;
}
