import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dispara Zapp — Automação Profissional para WhatsApp",
  description: "Envie mensagens em massa, agende campanhas e automatize seu WhatsApp com proteção anti-ban. Software 100% local para Windows.",
  keywords: "whatsapp automação, disparo em massa, whatsapp marketing, bot whatsapp",
  openGraph: {
    title: "Dispara Zapp — Automação Profissional para WhatsApp",
    description: "Envie mensagens em massa, agende campanhas e automatize seu WhatsApp com proteção anti-ban.",
    type: "website",
    locale: "pt_BR",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://disparazapp.com",
    siteName: "Dispara Zapp",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Dispara Zapp" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dispara Zapp — Automação para WhatsApp",
    description: "Envie mensagens em massa com proteção anti-ban. Software 100% local para Windows.",
    images: ["/og-image.png"],
  },
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
  const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="pt-BR" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#050505] text-white`}>
        {children}

        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
              nonce={nonce}
            />
            <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}
              dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');` }}
            />
          </>
        )}

        {META_PIXEL_ID && (
          <Script id="meta-pixel" strategy="afterInteractive" nonce={nonce}
            dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');` }}
          />
        )}
      </body>
    </html>
  );
}
