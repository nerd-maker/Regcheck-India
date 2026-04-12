import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

export const metadata: Metadata = {
    title: "RegCheck-India | Pharmaceutical Regulatory Compliance",
    description: "India's first CDSCO-native AI compliance platform. Automate pharmaceutical regulatory compliance evaluation for Indian clinical trial documents using sovereign AI.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} ${inter.className}`}>{children}</body>
        </html>
    );
}
