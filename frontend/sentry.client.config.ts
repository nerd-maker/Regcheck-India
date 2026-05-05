import * as Sentry from "@sentry/nextjs"

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_APP_ENV || "development",
    release: "regcheck-india@3.0.0",
    beforeSend(event) {
      // Scrub API keys from error reports
      if (event.extra) {
        Object.keys(event.extra).forEach(key => {
          if (key.toLowerCase().includes('key') ||
              key.toLowerCase().includes('token')) {
            event.extra![key] = '[REDACTED]'
          }
        })
      }
      return event
    }
  })
}
