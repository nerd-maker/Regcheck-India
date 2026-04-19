/** @type {import('next').NextConfig} */

const ContentSecurityPolicy = `
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
`;

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\n/g, ''),
  },
];

const nextConfig = {
    output: 'standalone',
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: securityHeaders,
            },
        ];
    },
}

module.exports = nextConfig
