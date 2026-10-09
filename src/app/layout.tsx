import type { Metadata, Viewport } from "next";
import "lenis/dist/lenis.css";
import "./globals.css";
import { ExperienceMotion } from "@/components/motion/experience-motion";

export const metadata: Metadata = {
  metadataBase: new URL("https://pactset.vercel.app"),
  title: { default: "Pactset · Event operations on Stellar Testnet", template: "%s · Pactset" },
  description: "A staged event operations platform for organizers, suppliers, crew, and assigned support, built around Stellar Testnet.",
  applicationName: "Pactset",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Pactset", description: "Coordinate venues, suppliers and crew, then approve milestone payments on Stellar Testnet.", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#061f1e", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="dark" data-scroll-behavior="smooth" style={{ colorScheme: "dark" }}><body><ExperienceMotion />{children}</body></html>;
}
