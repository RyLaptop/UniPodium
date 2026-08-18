import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://unipodium.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Unipodium — Student Org Speaker Platform",
  description:
    "Unipodium helps campus organizations communicate, collaborate, and coordinate — so student communities can work better together. Find orgs, request speaking slots, and stay connected with everything happening on campus.",
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Unipodium",
  url: "https://unipodium.com",
  logo: "https://unipodium.com/icon.svg",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const uni = jar.get("uni")?.value ?? "default";

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} data-uni={uni}>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </body>
    </html>
  );
}
