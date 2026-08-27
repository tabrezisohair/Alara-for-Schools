import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#102a56",
};

export const metadata: Metadata = {
  title: "Alara for Schools",
  description: "Your school’s in-house creative and social assistant",
  applicationName: "Alara",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Alara",
  },
  icons: {
    apple: "/icons/icon-180.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
