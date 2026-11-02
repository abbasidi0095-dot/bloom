import type { Metadata, Viewport } from "next";
import { localeMeta } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bloom — baby tracking, together",
    template: "%s · Bloom",
  },
  description:
    "A calm, shared baby tracker for feeding, sleep, diapers, growth, health and the little moments — private to your family.",
  applicationName: "Bloom",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Bloom",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Bloom — baby tracking, together",
    description: "Feeding, sleep, diapers and growth, shared calmly with the people who care.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f4ec" },
    { media: "(prefers-color-scheme: dark)", color: "#141110" },
  ],
};

const themeScript = `
(function () {
  try {
    var cookie = (document.cookie.match(/(?:^|; )bloom_theme=([^;]+)/) || [])[1];
    var stored = localStorage.getItem("bloom-theme") || cookie || "system";
    var dark = stored === "dark" || (stored === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getI18n();
  const dir = localeMeta[locale].dir;
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>
        <Providers locale={locale} dict={dict}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
