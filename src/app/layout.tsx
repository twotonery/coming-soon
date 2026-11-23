import type { Metadata, Viewport } from "next";
import { Epilogue, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const epilogue = Epilogue({ variable: "--font-epilogue", subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"] });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Twotonery — coming soon",
  description: "Thoughtful design for what comes next. Coming soon December 2026.",
  // links shared anywhere point at the real address, and their preview image (opengraph-image.jpg) with it
  metadataBase: new URL("https://twotonery.com"),
  openGraph: {
    title: "Twotonery — coming soon",
    description: "Thoughtful design for what comes next. Coming soon December 2026.",
    url: "/",
    siteName: "Twotonery",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Twotonery — coming soon", description: "Thoughtful design for what comes next. Coming soon December 2026." },
};

// the phone's browser bars start in the Sunset stone's colour (ComingSoon.tsx keeps them in step)
export const viewport: Viewport = { themeColor: "#5b7d7b", viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // --hero-h / --nav-h size the hero and the navbar that docks at the top; anchors land below the bar.
    <html lang="en" className={`${epilogue.variable} ${geistSans.variable} ${geistMono.variable} antialiased [--hero-h:100dvh] [--nav-h:68px] scroll-pt-(--nav-h)`}>
      <body className="min-h-full bg-[#5b7d7b] text-ink">
        {children}
      </body>
    </html>
  );
}
