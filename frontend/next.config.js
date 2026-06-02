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
            // ── AI Agents (must come BEFORE workspace routes) ──────────
            { source: '/api/regcheck/anonymise',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/anonymise' },
            { source: '/api/regcheck/summarise',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/summarise' },
            { source: '/api/regcheck/completeness',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/completeness' },
            { source: '/api/regcheck/classify',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/classify' },
            { source: '/api/regcheck/inspection-report',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/inspection-report' },
            { source: '/api/regcheck/qa',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/qa' },
            { source: '/api/regcheck/schedule-y',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/schedule-y' },
            { source: '/api/regcheck/ich-gcp',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/ich-gcp' },
            { source: '/api/regcheck/cross-document',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/cross-document' },
            { source: '/api/regcheck/extract-text',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/extract-text' },
            { source: '/api/regcheck/compare',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/compare' },
            { source: '/api/regcheck/ocr',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/ocr' },
            { source: '/api/regcheck/transcribe',
              destination: 'https://regcheck-india.onrender.com/api/v1/agents/transcribe' },

            // ── Health ─────────────────────────────────────────────────
            { source: '/api/regcheck/health',
              destination: 'https://regcheck-india.onrender.com/health' },

            // ── Agent Runs (B2) ────────────────────────────────────────
            { source: '/api/regcheck/agent-runs/:path*',
              destination: 'https://regcheck-india.onrender.com/api/v1/agent-runs/:path*' },

            // ── Workspace CRUD (P1) ────────────────────────────────────
            { source: '/api/regcheck/submissions/:path*',
              destination: 'https://regcheck-india.onrender.com/api/v1/submissions/:path*' },
            { source: '/api/regcheck/submissions',
              destination: 'https://regcheck-india.onrender.com/api/v1/submissions' },
            { source: '/api/regcheck/documents/:path*',
              destination: 'https://regcheck-india.onrender.com/api/v1/documents/:path*' },
            { source: '/api/regcheck/documents',
              destination: 'https://regcheck-india.onrender.com/api/v1/documents' },
            { source: '/api/regcheck/applications/:path*',
              destination: 'https://regcheck-india.onrender.com/api/v1/applications/:path*' },
            { source: '/api/regcheck/applications',
              destination: 'https://regcheck-india.onrender.com/api/v1/applications' },
            { source: '/api/regcheck/registrations/:path*',
              destination: 'https://regcheck-india.onrender.com/api/v1/registrations/:path*' },
            { source: '/api/regcheck/registrations',
              destination: 'https://regcheck-india.onrender.com/api/v1/registrations' },

            // ── HA Correspondence (P1 + P2) ────────────────────────────
            { source: '/api/regcheck/correspondence/:path*/state',
              destination: 'https://regcheck-india.onrender.com/api/v1/correspondence/:path*/state' },
            { source: '/api/regcheck/correspondence/:path*',
              destination: 'https://regcheck-india.onrender.com/api/v1/correspondence/:path*' },
            { source: '/api/regcheck/correspondence',
              destination: 'https://regcheck-india.onrender.com/api/v1/correspondence' },

            // ── Gap Remediations (P2) ──────────────────────────────────
            { source: '/api/regcheck/remediations/summary',
              destination: 'https://regcheck-india.onrender.com/api/v1/remediations/summary' },
            { source: '/api/regcheck/remediations/:path*',
              destination: 'https://regcheck-india.onrender.com/api/v1/remediations/:path*' },
            { source: '/api/regcheck/remediations',
              destination: 'https://regcheck-india.onrender.com/api/v1/remediations' },
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
