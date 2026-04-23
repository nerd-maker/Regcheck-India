/** @type {import('next').NextConfig} */

const nextConfig = {
    output: 'standalone',
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
                            "img-src 'self' data: blob: https:",
                            "connect-src 'self' https://regcheck-india.onrender.com https://api.anthropic.com",
                            "worker-src 'self' blob:",
                            "frame-src 'self' https://docs.google.com https://forms.google.com",
                        ].join('; ')
                    }
                ]
            }
        ];
    },
}

module.exports = nextConfig
