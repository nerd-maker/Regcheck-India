import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-body",
});

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-display",
});

export const metadata: Metadata = {
    title: "RegCheck-India | Pharmaceutical Regulatory Compliance",
    description: "AI-powered regulatory compliance evaluation for Indian pharmaceutical and clinical trial documents",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>{children}</body>
        </html>
    );
}
