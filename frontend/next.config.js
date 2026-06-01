/** @type {import('next').NextConfig} */

// ─── Backend base for the proxy ──────────────────────────────────────────────
// All `/api/regcheck/*` requests from the browser are forwarded server-side
// to this origin → no CORS issues in the browser, key never leaves the network.
const REGCHECK_API_BASE =
    process.env.REGCHECK_API_BASE || 'https://regcheck-india.onrender.com'

const nextConfig = {
    output: 'standalone',
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    },
    async rewrites() {
        return [
            {
                // Agent run history + trend (maps to /api/v1/agent-runs, NOT /api/v1/agents)
                source: '/api/regcheck/agent-runs/:path*',
                destination: `${REGCHECK_API_BASE}/api/v1/agent-runs/:path*`,
            },
            // ── Workspace CRUD (P1) — must come BEFORE the catch-all agents rule ──
            {
                source: '/api/regcheck/submissions/:path*',
                destination: `${REGCHECK_API_BASE}/api/v1/submissions/:path*`,
            },
            {
                source: '/api/regcheck/documents/:path*',
                destination: `${REGCHECK_API_BASE}/api/v1/documents/:path*`,
            },
            {
                source: '/api/regcheck/applications/:path*',
                destination: `${REGCHECK_API_BASE}/api/v1/applications/:path*`,
            },
            {
                source: '/api/regcheck/registrations/:path*',
                destination: `${REGCHECK_API_BASE}/api/v1/registrations/:path*`,
            },
            {
                source: '/api/regcheck/correspondence/:path*',
                destination: `${REGCHECK_API_BASE}/api/v1/correspondence/:path*`,
            },
            // ── Catch-all for AI agents ──────────────────────────────────────────
            {
                source: '/api/regcheck/:path*',
                destination: `${REGCHECK_API_BASE}/api/v1/agents/:path*`,
            },
        ]
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
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
                            "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
                            "img-src 'self' data: blob: https:",
                            "connect-src 'self' http://localhost:8000 https://regcheck-india.onrender.com https://regcheckindia.com https://api.anthropic.com https://api.sarvam.ai",
                            "media-src 'self' blob:",
                            "worker-src 'self' blob:",
                            "frame-src 'self' https://docs.google.com",
                            "object-src 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "frame-ancestors 'none'",
                        ].join('; ')
                    }
                ]
            }
        ];
    },
}

module.exports = nextConfig
