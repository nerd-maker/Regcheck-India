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
    description: "CDSCO-native AI compliance platform for Indian pharmaceutical and clinical trial workflows, powered by Anthropic Claude models.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className={`${inter.variable} ${inter.className}`}>{children}</body>
        </html>
    );
}
