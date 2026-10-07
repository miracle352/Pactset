import type { Metadata, Viewport } from "next";
import { ThemeScript } from "@/components/theme/theme-script";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pactset.vercel.app"),
  title: { default: "Pactset · Every detail. One shared plan.", template: "%s · Pactset" },
  description: "A staged event operations platform for organizers, suppliers, crew, and assigned support, built around Stellar Testnet.",
  applicationName: "Pactset",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Pactset", description: "Every detail. One shared plan.", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f5f7ff" }, { media: "(prefers-color-scheme: dark)", color: "#071126" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth"><head><ThemeScript /></head><body>{children}</body></html>;
}
