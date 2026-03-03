import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Compliance status colors
                'status-pass': '#10b981',
                'status-partial': '#f59e0b',
                'status-fail': '#ef4444',
                'status-unverified': '#6b7280',
                'status-na': '#9ca3af',

                // Risk level colors
                'risk-high': '#dc2626',
                'risk-medium': '#f59e0b',
                'risk-low': '#10b981',

                // Brand colors
                'primary': '#3b82f6',
                'secondary': '#8b5cf6',
            },
        },
    },
    plugins: [],
};

export default config;
