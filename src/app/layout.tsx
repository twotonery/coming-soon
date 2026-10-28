import type { Metadata } from "next";
import { Epilogue, Geist, Geist_Mono } from "next/font/google";
import "lenis/dist/lenis.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

const epilogue = Epilogue({ variable: "--font-epilogue", subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"] });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Twotonery — design partner for healthcare companies",
  description: "Twotonery is a design partner for medical and healthcare companies that need thoughtful design without the agency overhead.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // --hero-h / --nav-h size the hero and the navbar that docks at the top; anchors land below the bar.
    <html lang="en" className={`${epilogue.variable} ${geistSans.variable} ${geistMono.variable} antialiased [--hero-h:100dvh] [--nav-h:68px] scroll-pt-(--nav-h)`}>
      <body className="min-h-full bg-white text-ink">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
