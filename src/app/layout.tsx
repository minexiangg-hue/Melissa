import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
const display = localFont({
  src: [
    {
      path: "../../public/fonts/cormorant-regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/cormorant-italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-display",
  display: "swap",
});
const sans = localFont({
  src: "../../public/fonts/dm-sans.woff2",
  weight: "100 1000",
  variable: "--font-sans",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Melissa · A little more you",
  description:
    "A thoughtful English companion for the conversations that matter to you. Practice, discover, and find your words with Melissa.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  themeColor: "#f6f3e9",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
