import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { Analytics } from "@vercel/analytics/react";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "DARSHAN ENTERPRISES - Invoicing & Quotation Hub",
  description: "Secure, high-fidelity corporate quotation compiler, GST commercial tax billing ledger, and automatic Google Drive syncing engine for Darshan Enterprises.",
  keywords: [
    "Darshan Enterprises",
    "Darshan Enterprises Jhagadia",
    "Darshan Enterprises Ankleshwar",
    "Darshan Enterprises Quotation Hub",
    "Darshan Enterprises Invoicing Suite",
    "Darshan Enterprises Billing Portal",
    "Commercial Tax Invoices",
    "Corporate Quotation Generator",
    "GST Billing Jhagadia GIDC",
    "Ankleshwar GIDC Invoices"
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/Graphic Assets/DE_3D_Square_Logo.png",
    shortcut: "/Graphic Assets/DE_3D_Square_Logo.png",
    apple: "/Graphic Assets/DE_3D_Circle_Logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DE Invoicing & Quotation Hub",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "rgba(248, 250, 252, 0.4)" },
    { media: "(prefers-color-scheme: dark)", color: "rgba(15, 23, 42, 0.4)" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased selection:bg-primary/20" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
